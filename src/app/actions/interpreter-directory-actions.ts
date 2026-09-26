'use server';

/**
 * รายชื่อ/โปรไฟล์ล่ามสำหรับหน้าสาธารณะ — อ่านผ่าน Admin SDK แล้วส่งออกเฉพาะ allowlist
 *
 * firestore.rules ของ interpreterProfiles ไม่เปิด list ให้สาธารณะ (บทเรียนจาก lawyerProfiles
 * ที่เคยเปิด list แล้วเลขบัญชี/บัตรประชาชนหลุด — ดู lawyer-directory-actions.ts)
 * ข้อมูลติดต่อ เอกสาร และบัญชีรับเงินอยู่ใน subcollection private ไม่ถูกอ่านที่นี่เลย
 */

import { initAdmin } from '@/lib/firebase-admin';
import {
    INTERPRETER_LANGUAGE_CODES,
    type InterpreterLanguageCode,
    type InterpreterService,
    type PublicInterpreter,
} from '@/lib/interpreter-types';
import { toPublicInterpreter } from '@/lib/interpreter-public';

function clean<T>(o: T): T {
    return JSON.parse(JSON.stringify(o));
}

/** โปรไฟล์ล่ามที่อนุมัติแล้ว — ล่ามที่ยังไม่อนุมัติ/ถูกระงับ ถือว่าไม่มี */
export async function getPublicInterpreterAction(interpreterId: string): Promise<PublicInterpreter | null> {
    if (!interpreterId || typeof interpreterId !== 'string' || interpreterId.includes('/')) return null;
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return null;
        const snap = await adminApp.firestore().collection('interpreterProfiles').doc(interpreterId).get();
        if (!snap.exists || snap.data()?.status !== 'approved') return null;
        return clean(toPublicInterpreter(snap.id, snap.data() || {}));
    } catch (error) {
        console.error('Error fetching public interpreter:', error);
        return null;
    }
}

export async function getApprovedInterpretersAction(filters: {
    language?: string;
    service?: string;
    province?: string;
    remoteOnly?: boolean;
} = {}): Promise<PublicInterpreter[]> {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return [];
        let q: FirebaseFirestore.Query = adminApp.firestore()
            .collection('interpreterProfiles')
            .where('status', '==', 'approved');
        // array-contains ใช้ได้ครั้งเดียวต่อ query — ภาษาเป็นตัวกรองหลัก ที่เหลือกรองในหน่วยความจำ
        const language = filters.language as InterpreterLanguageCode | undefined;
        if (language && (INTERPRETER_LANGUAGE_CODES as readonly string[]).includes(language)) {
            q = q.where('languageCodes', 'array-contains', language);
        }
        const snap = await q.limit(200).get();
        const service = filters.service as InterpreterService | undefined;
        return clean(
            snap.docs
                .map(doc => toPublicInterpreter(doc.id, doc.data()))
                .filter(i => !service || i.services.includes(service))
                .filter(i => !filters.province || i.serviceProvinces.includes(filters.province) || i.remoteAvailable)
                .filter(i => !filters.remoteOnly || i.remoteAvailable)
        );
    } catch (error) {
        console.error('Error fetching approved interpreters:', error);
        return [];
    }
}
