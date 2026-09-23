/**
 * Case telemetry — ชั้น B ของแผน "กันทนายพาลูกความออกนอกแพลตฟอร์ม"
 *
 * เก็บเฉพาะ "เหตุการณ์สำคัญของเคส" ไม่ใช่ทุกข้อความ (ทุกข้อความนับที่ชั้น A
 * บน chats/{id} แทน เพราะ log ทุกข้อความจะเป็น write ที่แพงที่สุดในระบบ)
 *
 * 🔒 ข้อบังคับ: ทุก repo ของ Lawslane เป็น public และใช้ Firebase production
 * ร่วมกันโปรเจ็คเดียว — เอกสารใน caseEvents จึง **ห้ามมี PII เด็ดขาด**
 * ไม่มีเนื้อข้อความ ไม่มีชื่อ เบอร์ อีเมล เลขบัญชี และไม่มี clientId
 * เก็บได้แค่ id ของเคส/ทนาย ชนิดเหตุการณ์ เวลา และตัวเลข
 * (ดู buildCaseEvent — สร้าง object แบบระบุฟิลด์ตรงๆ ไม่ spread ของที่รับเข้ามา)
 */

import { FieldValue } from 'firebase-admin/firestore';

export type CaseEventType =
    | 'case_opened'
    | 'first_client_message'
    | 'first_lawyer_reply'
    | 'contact_signal'
    | 'bank_card_sent'
    | 'fee_agreement_recorded'
    | 'invoice_created'
    | 'receipt_issued'
    | 'contract_signed'
    | 'appointment_requested'
    | 'appointment_confirmed'
    | 'milestone_completed'
    | 'vault_doc_shared'
    | 'case_closed'
    | 'review_submitted';

export interface CaseEventInput {
    /** chats doc id หรือ legalCases doc id */
    caseId: string;
    caseKind?: 'chat' | 'legal';
    /** lawyerProfiles doc id — ใช้ join กับการจัดอันดับ ไม่ใช่ auth uid */
    lawyerId: string;
    type: CaseEventType;
    actor: 'lawyer' | 'client' | 'system';
    /** payload ตัวเลขเท่านั้น เช่น latency นาที, คะแนนรีวิว, ลำดับข้อความ */
    n?: number;
}

/**
 * คีย์วันแบบ Asia/Bangkok (YYYY-MM-DD) เพื่อให้ rollup query ช่วงวันได้
 * โดยไม่ต้องแปลง timezone ตอนอ่าน
 */
export function bangkokDayKey(d: Date = new Date()): string {
    // en-CA ให้รูปแบบ YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d);
}

function buildCaseEvent(e: CaseEventInput) {
    // ระบุฟิลด์ตรงๆ ทีละตัว — กันไม่ให้ caller เผลอ spread ข้อมูลอื่นเข้ามา
    const doc: Record<string, unknown> = {
        caseId: e.caseId,
        caseKind: e.caseKind ?? 'chat',
        lawyerId: e.lawyerId,
        type: e.type,
        actor: e.actor,
        at: FieldValue.serverTimestamp(),
        dayKey: bangkokDayKey(),
    };
    if (typeof e.n === 'number' && Number.isFinite(e.n)) {
        doc.n = e.n;
    }
    return doc;
}

/**
 * แปลง auth uid → lawyerProfiles doc id
 *
 * จำเป็นเพราะสองคอลเลกชันเก็บเจ้าของคนละแบบ:
 *   chats.lawyerId    = lawyerProfiles doc id
 *   legalCases.lawyer_id = auth uid
 * caseEvents.lawyerId ต้องเป็น lawyerProfiles doc id เสมอ ไม่งั้น rollup
 * จะ join ไม่ติดและตัวเลขของทนายคนเดียวจะแตกเป็นสองก้อน
 *
 * ใช้เฉพาะกับ event ที่เกิดไม่บ่อย (ปิด milestone, แชร์เอกสาร, ออกใบแจ้งหนี้)
 * ห้ามเรียกใน path ต่อข้อความ
 */
export async function resolveLawyerProfileId(
    db: FirebaseFirestore.Firestore,
    uid: string,
): Promise<string | null> {
    try {
        const snap = await db.collection('lawyerProfiles')
            .where('userId', '==', uid)
            .limit(1)
            .get();
        return snap.empty ? null : snap.docs[0].id;
    } catch {
        return null;
    }
}

/**
 * สวิตช์ telemetry — อ่านจาก settings/platform.telemetryEnabled
 *
 * ค่าเริ่มต้นคือ "ปิด": ฝั่งเขียน (counters + caseEvents) ต่อสายครบแล้ว แต่ฝั่งใช้งาน
 * (rollup → lawyerMetrics, rank.score บน lawyerProfiles, หน้าที่ให้ทนายดู metric)
 * ยังไม่มี ถ้าเปิดทันทีตอน deploy จะเขียนลง Firestore production ที่ 5 repo ใช้ร่วมกัน
 * ทุกข้อความ/ทุกเคสโดยไม่มีใครอ่าน — ต้องตั้ง telemetryEnabled=true เองเมื่อพร้อม
 */
let telemetryCache: { value: boolean; at: number } | null = null;
const TELEMETRY_CACHE_MS = 60_000;

export async function isTelemetryEnabled(db: FirebaseFirestore.Firestore): Promise<boolean> {
    const now = Date.now();
    if (telemetryCache && now - telemetryCache.at < TELEMETRY_CACHE_MS) {
        return telemetryCache.value;
    }
    try {
        const snap = await db.collection('settings').doc('platform').get();
        // ค่าเริ่มต้นคือปิด — ต้องตั้ง telemetryEnabled=true เท่านั้นถึงจะเปิด (ดูเหตุผลด้านบน)
        const value = snap.exists ? snap.data()?.telemetryEnabled === true : false;
        telemetryCache = { value, at: now };
        return value;
    } catch {
        // อ่าน settings ไม่ได้ก็ไม่ควรทำให้ flow หลักพัง — ถือว่าปิด (ปลอดภัยกว่า)
        telemetryCache = { value: false, at: now };
        return false;
    }
}

/**
 * ใส่ event ลง batch ที่ caller มีอยู่แล้ว — ไม่เพิ่ม round-trip
 * caller ต้องเช็ค isTelemetryEnabled() เองก่อน (เพราะฟังก์ชันนี้ sync)
 */
export function addCaseEventToBatch(
    db: FirebaseFirestore.Firestore,
    batch: FirebaseFirestore.WriteBatch,
    e: CaseEventInput,
): void {
    batch.set(db.collection('caseEvents').doc(), buildCaseEvent(e));
}

/**
 * เขียน event แบบเดี่ยว — fire-and-forget
 * telemetry ล่มต้องไม่ทำให้ business logic ล่ม จึงกลืน error ทุกกรณี
 */
export async function logCaseEvent(
    db: FirebaseFirestore.Firestore,
    e: CaseEventInput,
): Promise<void> {
    try {
        if (!(await isTelemetryEnabled(db))) return;
        await db.collection('caseEvents').add(buildCaseEvent(e));
    } catch (error) {
        console.error('[telemetry] logCaseEvent failed (non-blocking):', error);
    }
}
