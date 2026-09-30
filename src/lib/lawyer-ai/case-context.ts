import 'server-only';

import type { AiCaseFolder } from '@/lib/lawyer-ai/types';

type Db = FirebaseFirestore.Firestore;

function parseMetadata(raw: unknown): Record<string, unknown> {
    if (typeof raw !== 'string') return {};
    try {
        const v = JSON.parse(raw);
        return v && typeof v === 'object' ? v : {};
    } catch {
        return {};
    }
}

/** เจ้าของคดีคือ lawyer_id (auth uid) — ดู requireCaseOwner ใน lawyer-case-actions */
export async function getOwnedCase(db: Db, uid: string, caseId: string) {
    const snap = await db.collection('legalCases').doc(caseId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (data.lawyer_id !== uid && data.lawyerId !== uid) return null;
    return { id: snap.id, data };
}

export async function listCaseFolders(db: Db, uid: string): Promise<AiCaseFolder[]> {
    const snap = await db.collection('legalCases').where('lawyer_id', '==', uid).orderBy('updatedAt', 'desc').limit(100).get();
    return snap.docs.map(d => {
        const data = d.data();
        const meta = parseMetadata(data.metadata);
        return {
            id: d.id,
            title: String(data.title || 'คดีไม่มีชื่อ'),
            clientName: String(meta.clientName || ''),
            status: String(data.status || ''),
        };
    });
}

/**
 * สรุปข้อมูลคดีให้ AI ใช้เป็นบริบท — ข้อเท็จจริงจากพยานหลักฐาน รายชื่อพยาน และขั้นตอนงาน
 * ไม่ส่ง URL ไฟล์ / ข้อมูลติดต่อลูกความ ให้ AI (ไม่จำเป็นต่องาน และลดข้อมูลส่วนตัวที่ออกไปนอกระบบ)
 */
export async function buildCaseContext(db: Db, caseId: string, data: FirebaseFirestore.DocumentData): Promise<string> {
    const meta = parseMetadata(data.metadata);
    const ref = db.collection('legalCases').doc(caseId);
    const [evidence, witnesses, milestones] = await Promise.all([
        ref.collection('evidence').orderBy('createdAt', 'asc').limit(40).get(),
        ref.collection('witnesses').orderBy('createdAt', 'asc').limit(40).get(),
        db.collection('milestones').where('case_id', '==', caseId).limit(40).get(),
    ]);

    const lines = [
        `ชื่อคดี: ${data.title || '-'}`,
        meta.clientName ? `ลูกความ: ${meta.clientName}` : '',
        meta.category ? `ประเภทคดี: ${meta.category}` : '',
        meta.court ? `ศาล: ${meta.court}` : '',
        data.description ? `รายละเอียด: ${String(data.description).slice(0, 2000)}` : '',
        data.status ? `สถานะ: ${data.status}` : '',
    ].filter(Boolean);

    if (!evidence.empty) {
        lines.push('', 'พยานหลักฐานและข้อเท็จจริง:');
        evidence.docs.forEach((d, i) => {
            const e = d.data();
            lines.push(`${i + 1}. ${e.title || 'ไม่มีชื่อ'}${e.fact ? ` — ${String(e.fact).slice(0, 600)}` : ''}`);
        });
    }
    if (!witnesses.empty) {
        lines.push('', 'พยานบุคคล:');
        witnesses.docs.forEach((d, i) => {
            const w = d.data();
            lines.push(`${i + 1}. ${w.name || '-'}${w.role ? ` (${w.role})` : ''}`);
        });
    }
    if (!milestones.empty) {
        lines.push('', 'ขั้นตอนงาน:');
        milestones.docs
            .map(d => d.data())
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .forEach(m => lines.push(`- [${m.status === 'completed' ? 'x' : ' '}] ${m.title}`));
    }
    return lines.join('\n').slice(0, 12_000);
}
