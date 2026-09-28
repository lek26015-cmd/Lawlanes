import * as admin from 'firebase-admin';
import { bahtText } from './baht-text';
import type { Receipt, ReceiptSource } from './types';

/**
 * ออกใบเสร็จรับเงิน "ในนามทนาย" (ทนายเป็นผู้รับเงิน — Lawslane เป็นแค่ระบบที่ออกเอกสาร)
 * ดู LAWSLANE-PLAN-06 รอบ 5
 *
 * ⚠️ เรียกได้เฉพาะจุดที่ "ทนายยืนยันรับเงินเองแล้ว" (confirmDirectPaymentReceivedAction ใน
 * branch remove-platform-money) — ใน main ตอนนี้เงินเคสยังเข้าบัญชีแพลตฟอร์ม ถ้าเรียกจากเส้นทาง
 * จ่ายเงินของ main ใบเสร็จจะบอกว่าทนายรับเงินทั้งที่ไม่ได้รับ
 *
 * - เลขที่เรียงต่อกันต่อทนายต่อปี (RC-2026-000001) ไม่ข้าม ไม่ซ้ำ — นับใน transaction
 * - กันออกซ้ำ: id ใบเสร็จมาจาก chatId + รายการที่จ่าย เรียกซ้ำได้ใบเดิม
 * - เก็บสำเนาข้อมูล ณ วันออก (ชื่อ ที่อยู่ ยอด) — แก้โปรไฟล์ทีหลังใบเก่าไม่เปลี่ยน
 * - ข้อมูลผู้ออกเอาจากโปรไฟล์ทนายเท่านั้น ไม่มีให้เว้น ห้ามเดา/เติมเอง
 * - ไม่ใส่เลขบัตรประชาชนของลูกความ (clientInfo.taxId) — ใบเสร็จไม่ต้องใช้
 */

export interface IssueReceiptInput {
    chatId: string;
    source: ReceiptSource;
    /** รายการบนใบเสร็จ เช่น "งวดที่ 2" / "ค่าบริการ" / "ค่าบริการเพิ่มเติม" */
    label: string;
    amount: number;
    paidAt: Date;
    /** uid ของคนที่กดยืนยันรับเงิน (ทนายหรือแอดมิน) */
    confirmedBy: string;
    paymentMethod?: string;
}

export class ReceiptError extends Error {}

function sourceKey(source: ReceiptSource): string {
    switch (source.type) {
        case 'installment': return `inst${source.installmentIndex}`;
        case 'additional': return `add${source.additionalIndex}`;
        case 'case': return 'case';
    }
}

/** ปี ค.ศ. ตามเวลาไทย — ใบเสร็จที่ออกหลังเที่ยงคืน 31 ธ.ค. เวลาไทยต้องขึ้นปีใหม่ */
function bangkokYear(d: Date): number {
    return new Date(d.getTime() + 7 * 60 * 60 * 1000).getUTCFullYear();
}

async function findLawyerProfile(db: admin.firestore.Firestore, chat: admin.firestore.DocumentData) {
    const profileId: string | undefined = chat.lawyerId || chat.lawyer_id;
    if (profileId) {
        const snap = await db.collection('lawyerProfiles').doc(profileId).get();
        if (snap.exists) return snap;
    }
    // ห้องที่มีแค่ uid ทนายใน participants (id โปรไฟล์ ≠ uid เสมอไป)
    const clientUid = chat.clientId || chat.userId;
    const lawyerUid = (chat.participants || []).find((p: string) => p !== clientUid) || profileId;
    if (!lawyerUid) return null;
    const byOwner = await db.collection('lawyerProfiles').where('userId', '==', lawyerUid).limit(1).get();
    return byOwner.empty ? null : byOwner.docs[0];
}

export async function issueReceipt(
    db: admin.firestore.Firestore,
    input: IssueReceiptInput,
): Promise<{ receiptId: string; receiptNo: string; created: boolean }> {
    const amount = Math.round(Number(input.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) throw new ReceiptError('ยอดเงินไม่ถูกต้อง');

    const chatSnap = await db.collection('chats').doc(input.chatId).get();
    if (!chatSnap.exists) throw new ReceiptError('ไม่พบห้องสนทนา');
    const chat = chatSnap.data()!;

    const profileSnap = await findLawyerProfile(db, chat);
    if (!profileSnap) throw new ReceiptError('ไม่พบโปรไฟล์ทนายของเคสนี้');
    const lp = profileSnap.data()!;
    const issuerName: string = (lp.corporateName || lp.name || '').trim();
    if (!issuerName) throw new ReceiptError('โปรไฟล์ทนายไม่มีชื่อ ออกใบเสร็จไม่ได้');

    const payerUid: string = chat.clientId || chat.userId || '';
    if (!payerUid) throw new ReceiptError('ไม่พบลูกความของเคสนี้');
    const payerUser = await db.collection('users').doc(payerUid).get();
    const pu = payerUser.data() || {};
    const payerName: string = (chat.clientInfo?.name || pu.name || pu.displayName || '').trim();

    const receiptId = `${input.chatId}__${sourceKey(input.source)}`;
    const receiptRef = db.collection('receipts').doc(receiptId);
    const issuedAt = new Date();
    const year = bangkokYear(issuedAt);
    const counterRef = db.collection('receiptCounters').doc(`${profileSnap.id}_${year}`);

    return db.runTransaction(async (tx) => {
        const [existing, counter] = await Promise.all([tx.get(receiptRef), tx.get(counterRef)]);
        if (existing.exists) {
            return { receiptId, receiptNo: existing.data()!.receiptNo as string, created: false };
        }
        const seq = (counter.exists ? Number(counter.data()!.lastSeq) || 0 : 0) + 1;
        const receiptNo = `RC-${year}-${String(seq).padStart(6, '0')}`;

        const receipt: Omit<Receipt, 'id'> = {
            receiptNo,
            status: 'issued',
            issuerType: 'lawyer',
            lawyerProfileId: profileSnap.id,
            lawyerUid: lp.userId || '',
            issuer: {
                name: issuerName,
                address: (lp.corporateAddress || lp.address || '').trim() || null,
                taxId: (lp.corporateTaxId || '').trim() || null,
                licenseNumber: (lp.licenseNumber || '').trim() || null,
            },
            payerUid,
            payer: {
                name: payerName || null,
                address: (chat.clientInfo?.address || '').trim() || null,
            },
            chatId: input.chatId,
            caseTitle: chat.caseTitle || null,
            source: input.source,
            items: [{ description: input.label, amount }],
            amount,
            amountText: bahtText(amount),
            paymentMethod: input.paymentMethod || null,
            paidAt: admin.firestore.Timestamp.fromDate(input.paidAt),
            confirmedBy: input.confirmedBy,
            issuedAt: admin.firestore.Timestamp.fromDate(issuedAt),
        };

        tx.set(counterRef, { lastSeq: seq, lawyerProfileId: profileSnap.id, year }, { merge: true });
        tx.set(receiptRef, receipt);
        return { receiptId, receiptNo, created: true };
    });
}

/** ยกเลิกใบเสร็จ (แอดมินเท่านั้น — ผู้เรียกต้องเช็คสิทธิ์เอง) ลบไม่ได้ เลขที่ไม่ถูกใช้ซ้ำ */
export async function voidReceipt(
    db: admin.firestore.Firestore,
    receiptId: string,
    reason: string,
    voidedBy: string,
): Promise<void> {
    if (!reason.trim()) throw new ReceiptError('ต้องระบุเหตุผลที่ยกเลิก');
    const ref = db.collection('receipts').doc(receiptId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ReceiptError('ไม่พบใบเสร็จ');
        if (snap.data()!.status === 'void') throw new ReceiptError('ใบเสร็จนี้ถูกยกเลิกไปแล้ว');
        tx.update(ref, {
            status: 'void',
            voidReason: reason.trim(),
            voidedBy,
            voidedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
}
