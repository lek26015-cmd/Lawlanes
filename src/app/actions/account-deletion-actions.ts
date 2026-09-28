'use server';

/**
 * ผู้ใช้ลบบัญชีของตัวเอง (หน้า /account → โซนอันตราย)
 *
 * ตามนโยบายความเป็นส่วนตัว: "ลบหรือทำให้ข้อมูลไม่สามารถระบุตัวท่านได้ ยกเว้นข้อมูลที่ต้องเก็บตามกฎหมาย"
 *   ลบ/ปกปิด: บัญชีล็อกอิน (Firebase Auth), users/{uid}, โปรไฟล์ทนาย/ล่าม (ซ่อนจากเว็บ + ตัด PII),
 *             การแจ้งเตือน, ชื่อ/รูปบนรีวิวและคอมเมนต์, ชื่อ/อีเมลบนตั๋วซัพพอร์ต, ไฟล์ส่วนตัวใน Storage
 *   เก็บไว้:  การชำระเงิน ใบแจ้งหนี้ การถอนเงิน payout สลิป (กฎหมายบัญชี/ภาษี) และแชทเคส
 *             ที่คู่กรณีอีกฝ่ายยังใช้อยู่ (ข้อความของท่านในแชทยังอยู่ แต่บัญชีถูกลบแล้ว)
 *
 * กันพลาด: ต้องล็อกอินใหม่ภายใน 15 นาที + พิมพ์คำยืนยัน · ห้ามลบเมื่อยังมีงานค้าง
 * (เคส/นัด/งานล่ามที่ยังไม่จบ, payout ที่ยังไม่ได้รับ, เป็นเจ้าของบริษัท B2B) · แอดมินลบตัวเองไม่ได้
 */

import * as admin from 'firebase-admin';
import { requireUser } from '@/lib/auth-guard';
import { SLOT_HOLDING_STATUSES } from '@/lib/interpreter-types';
import { DELETE_CONFIRM_PHRASE } from '@/lib/account-deletion';

const RECENT_LOGIN_SECONDS = 15 * 60;

const OPEN_CHAT = ['pending_payment', 'paid', 'active'];
const OPEN_APPOINTMENT = ['pending_payment', 'paid', 'confirmed'];
const DELETED_NAME = 'ผู้ใช้ที่ลบบัญชีแล้ว';

// ไฟล์ส่วนตัวใน Firebase Storage ที่ path ผูกกับ uid (ดู storage.rules)
const STORAGE_PREFIXES = ['lawyer_documents', 'profiles', 'users', 'interpreter_documents', 'interpreter_booking_docs'];

export type DeleteAccountResult =
    | { ok: true }
    | { ok: false; reason: 'confirm' | 'reauth' | 'admin' | 'blocked' | 'error'; blockers?: string[] };

type Db = FirebaseFirestore.Firestore;

async function blockersFor(db: Db, uid: string, lawyerProfileIds: string[]): Promise<string[]> {
    const out: string[] = [];

    const chats = await db.collection('chats').where('participants', 'array-contains', uid).limit(500).get();
    if (chats.docs.some((d) => OPEN_CHAT.includes(d.get('status')))) out.push('มีเคส/แชทกับทนายที่ยังไม่ปิด');

    const apptQueries = [db.collection('appointments').where('userId', '==', uid).limit(500).get()];
    for (const id of lawyerProfileIds) apptQueries.push(db.collection('appointments').where('lawyerId', '==', id).limit(500).get());
    const appts = await Promise.all(apptQueries);
    if (appts.some((s) => s.docs.some((d) => OPEN_APPOINTMENT.includes(d.get('status'))))) out.push('มีนัดหมายที่ยังไม่จบ');

    const [asCustomer, asInterpreter] = await Promise.all([
        db.collection('interpreterBookings').where('customerId', '==', uid).limit(500).get(),
        db.collection('interpreterBookings').where('interpreterUserId', '==', uid).limit(500).get(),
    ]);
    const holding = SLOT_HOLDING_STATUSES as readonly string[];
    if ([...asCustomer.docs, ...asInterpreter.docs].some((d) => holding.includes(d.get('status')))) out.push('มีงานล่ามที่ยังไม่จบ');
    if (asInterpreter.docs.some((d) => d.get('payoutStatus') === 'due')) out.push('มียอดค่าจ้างล่ามที่ยังไม่ได้รับ');

    const companies = await db.collection('companies').where('ownerId', '==', uid).limit(1).get();
    if (!companies.empty) out.push('เป็นเจ้าของบัญชีบริษัท (B2B) — โอนสิทธิ์หรือปิดบริษัทก่อน');

    return out;
}

/** ตรวจก่อนเปิดหน้าต่างยืนยัน — บอกผู้ใช้ล่วงหน้าว่าลบได้ไหม */
export async function checkAccountDeletionAction(): Promise<{ canDelete: boolean; needsReauth: boolean; blockers: string[] }> {
    const { uid, token, adminApp } = await requireUser();
    if (token.admin === true || token.role === 'admin') return { canDelete: false, needsReauth: false, blockers: ['บัญชีแอดมินลบเองไม่ได้ ติดต่อผู้ดูแลระบบ'] };
    const db = adminApp.firestore();
    const lawyerIds = await lawyerProfileIdsFor(db, uid);
    const blockers = await blockersFor(db, uid, lawyerIds);
    const needsReauth = Date.now() / 1000 - Number(token.auth_time || 0) > RECENT_LOGIN_SECONDS;
    return { canDelete: blockers.length === 0, needsReauth, blockers };
}

async function lawyerProfileIdsFor(db: Db, uid: string): Promise<string[]> {
    const ids = new Set<string>();
    const [byId, byField] = await Promise.all([
        db.collection('lawyerProfiles').doc(uid).get(),
        db.collection('lawyerProfiles').where('userId', '==', uid).limit(10).get(),
    ]);
    if (byId.exists) ids.add(byId.id);
    byField.docs.forEach((d) => ids.add(d.id));
    return [...ids];
}

/** เขียนเป็นชุด ๆ ละไม่เกิน 400 (ขีดจำกัด batch 500) */
async function commitInChunks(db: Db, ops: ((b: FirebaseFirestore.WriteBatch) => void)[]) {
    for (let i = 0; i < ops.length; i += 400) {
        const batch = db.batch();
        ops.slice(i, i + 400).forEach((op) => op(batch));
        await batch.commit();
    }
}

export async function deleteMyAccountAction(confirmPhrase: string): Promise<DeleteAccountResult> {
    try {
        if (String(confirmPhrase || '').trim() !== DELETE_CONFIRM_PHRASE) return { ok: false, reason: 'confirm' };
        const { uid, token, adminApp } = await requireUser();
        if (token.admin === true || token.role === 'admin') return { ok: false, reason: 'admin' };
        if (Date.now() / 1000 - Number(token.auth_time || 0) > RECENT_LOGIN_SECONDS) return { ok: false, reason: 'reauth' };

        const db = adminApp.firestore();
        const lawyerIds = await lawyerProfileIdsFor(db, uid);
        const blockers = await blockersFor(db, uid, lawyerIds);
        if (blockers.length) return { ok: false, reason: 'blocked', blockers };

        const now = admin.firestore.FieldValue.serverTimestamp();
        const ops: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
        const userRef = db.collection('users').doc(uid);
        const priorRole = (await userRef.get()).get('role') || null;

        // users/{uid} — เขียนทับทั้งเอกสาร (ตัด PII ทุกฟิลด์) เหลือแค่ร่องรอยว่าถูกลบ
        ops.push((b) => b.set(userRef, { deleted: true, deletedAt: now, name: DELETED_NAME, role: priorRole }));
        const integrations = await userRef.collection('integrations').get();
        integrations.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));

        // โปรไฟล์ทนาย — status อื่นที่ไม่ใช่ approved ไม่แสดงบนเว็บ (หน้าโปรไฟล์เป็น 404)
        for (const id of lawyerIds) {
            const ref = db.collection('lawyerProfiles').doc(id);
            ops.push((b) => b.set(ref, { userId: uid, status: 'deleted', deletedAt: now, name: DELETED_NAME }));
        }

        // โปรไฟล์ล่าม + ข้อมูลติดต่อ/เอกสาร/บัญชีธนาคารใน private
        const interp = db.collection('interpreterProfiles').doc(uid);
        if ((await interp.get()).exists) {
            const priv = await interp.collection('private').get();
            priv.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
            ops.push((b) => b.set(interp, { userId: uid, status: 'deleted', deletedAt: now, name: DELETED_NAME }));
        }

        const [notifs, reviews, comments, tickets, verifyTokens] = await Promise.all([
            db.collection('notifications').where('recipient', '==', uid).limit(2000).get(),
            db.collection('reviews').where('userId', '==', uid).limit(1000).get(),
            db.collection('articleComments').where('userId', '==', uid).limit(1000).get(),
            db.collection('tickets').where('userId', '==', uid).limit(500).get(),
            db.collection('email_verification_tokens').where('uid', '==', uid).limit(50).get(),
        ]);
        notifs.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
        verifyTokens.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
        // รีวิวยังแสดงต่อ (คะแนนของทนาย) แต่ไม่แสดงชื่อ/รูป — ตามนโยบายความเป็นส่วนตัว
        reviews.docs.forEach((d) => ops.push((b) => b.update(d.ref, { author: DELETED_NAME, avatar: '' })));
        comments.docs.forEach((d) => ops.push((b) => b.update(d.ref, { userName: DELETED_NAME, userAvatar: '' })));
        tickets.docs.forEach((d) => ops.push((b) => b.update(d.ref, { clientName: DELETED_NAME, email: '' })));
        ops.push((b) => b.delete(db.collection('rate_limits').doc(uid)));

        // บันทึกการลบ (ไม่มี PII) ไว้ตรวจสอบย้อนหลัง
        ops.push((b) => b.set(db.collection('accountDeletions').doc(uid), {
            deletedAt: now,
            role: priorRole,
            lawyerProfiles: lawyerIds.length,
            counts: { notifications: notifs.size, reviews: reviews.size, comments: comments.size, tickets: tickets.size },
        }));

        await commitInChunks(db, ops);

        // ไฟล์ส่วนตัว — ลบไม่ครบก็ไม่ให้การลบบัญชีล้ม (cron ล้างไฟล์กำพร้าจะตามเก็บ)
        try {
            const bucket = adminApp.storage().bucket();
            const prefixes = [
                ...STORAGE_PREFIXES.map((p) => `${p}/${uid}/`),
                ...lawyerIds.filter((id) => id !== uid).map((id) => `lawyerProfiles/${id}/`),
            ];
            await Promise.all(prefixes.map((prefix) => bucket.deleteFiles({ prefix }).catch(() => undefined)));
        } catch (err) {
            console.error('[deleteMyAccount] storage cleanup failed', err);
        }

        await adminApp.auth().revokeRefreshTokens(uid);
        await adminApp.auth().deleteUser(uid);
        return { ok: true };
    } catch (e: any) {
        console.error('[deleteMyAccount] failed', e?.message);
        return { ok: false, reason: 'error' };
    }
}
