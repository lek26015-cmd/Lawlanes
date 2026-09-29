'use server';

import * as admin from 'firebase-admin';
import { requireUser, AuthError } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/security/rate-limiter';

/**
 * ลูกความขอนัดหมายทนาย — ฟรี ไม่ผ่านการชำระเงินของแพลตฟอร์ม
 *
 * เดิมนัดหมายเกิดได้ทางเดียวคือหน้า /payment (createAppointment) ที่เก็บค่านัด ฿3,500 เข้าบัญชี
 * แพลตฟอร์มแล้วตั้ง status 'paid' / 'pending_payment' ตามผลตรวจสลิป ทนายรับได้เฉพาะ 'paid'
 * ตอนนี้ Lawslane ไม่ถือเงินแล้ว: คำขอเกิดที่ status 'pending' → ทนายรับ/ปฏิเสธผ่าน
 * respondToAppointmentRequestAction ค่าบริการ (ถ้ามี) ทนายเสนอในแชทแล้วลูกความจ่ายทนายโดยตรง
 *
 * firestore.rules ของ appointments ยังเป็น create: isAdmin() — สร้างผ่าน Admin SDK ที่นี่ที่เดียว
 * ตัวตนผู้ขอมาจาก session · ทนายต้องมีโปรไฟล์ที่อนุมัติแล้ว · uid ทนายอ่านจาก lawyerProfiles
 * (ไม่รับจาก client) · วันนัดต้องอยู่ในช่วงที่หน้าจองเปิดให้เลือก และไม่ตรงวันที่ทนายปิดรับ
 */

const MAX_DAYS_AHEAD = 60;
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export async function requestAppointmentAction(input: {
    lawyerId: string;
    appointmentDate: string;
    description: string;
}): Promise<{ ok: true; appointmentId: string } | { ok: false; error: string }> {
    try {
        const { uid, adminApp } = await requireUser();
        const db = adminApp.firestore();

        const limit = await checkRateLimit(`appointment-request:${uid}`, 5, 60 * 60 * 1000);
        if (!limit.success) return { ok: false, error: 'ส่งคำขอนัดหมายถี่เกินไป กรุณาลองใหม่ภายหลัง' };

        const lawyerId = typeof input.lawyerId === 'string' ? input.lawyerId.trim() : '';
        const description = typeof input.description === 'string' ? input.description.trim() : '';
        if (!lawyerId) return { ok: false, error: 'ไม่พบทนายความปลายทาง' };
        if (!description) return { ok: false, error: 'กรุณาอธิบายปัญหาโดยย่อ' };
        if (description.length > 2000) return { ok: false, error: 'รายละเอียดยาวเกินไป (ไม่เกิน 2,000 ตัวอักษร)' };

        const snap = await db.collection('lawyerProfiles').doc(lawyerId).get();
        const lawyer = snap.exists ? snap.data()! : null;
        if (!lawyer?.userId || lawyer.status !== 'approved') return { ok: false, error: 'ไม่พบทนายความปลายทาง' };
        if (lawyer.userId === uid) return { ok: false, error: 'ไม่สามารถนัดหมายกับตัวเองได้' };

        const when = new Date(input.appointmentDate);
        if (Number.isNaN(when.getTime())) return { ok: false, error: 'วันเวลานัดหมายไม่ถูกต้อง' };
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const lastDay = new Date(todayStart); lastDay.setDate(lastDay.getDate() + MAX_DAYS_AHEAD + 1);
        if (when < todayStart || when >= lastDay) {
            return { ok: false, error: `เลือกวันนัดได้ภายใน ${MAX_DAYS_AHEAD} วันนับจากวันนี้` };
        }
        // ตารางของทนาย (lawyer-schedule) — ปฏิทินฝั่งลูกความปิดวันเหล่านี้อยู่แล้ว ตรวจซ้ำฝั่ง server
        const schedule = lawyer.schedule;
        if (schedule) {
            const dayKey = DAY_KEYS[when.getDay()];
            if (schedule.availableDays && schedule.availableDays[dayKey] === false) {
                return { ok: false, error: 'ทนายไม่รับนัดในวันดังกล่าว' };
            }
            const blocked = (Array.isArray(schedule.overrides) ? schedule.overrides : [])
                .some((ov: any) => new Date(ov?.date).toDateString() === when.toDateString());
            if (blocked) return { ok: false, error: 'ทนายไม่รับนัดในวันดังกล่าว' };
        }

        // คำขอค้างกับทนายคนเดิมมีได้ทีละใบ — กันกดซ้ำ/ยิงรัวใส่ทนายคนเดียว
        const dup = await db.collection('appointments')
            .where('userId', '==', uid)
            .where('lawyerId', '==', lawyerId)
            .where('status', '==', 'pending')
            .limit(1)
            .get();
        if (!dup.empty) return { ok: false, error: 'คุณมีคำขอนัดหมายกับทนายท่านนี้ที่รอการตอบรับอยู่แล้ว' };

        const ref = db.collection('appointments').doc();
        const ts = admin.firestore.Timestamp.fromDate(when);
        await ref.set({
            userId: uid,
            lawyerId,                       // id ของ lawyerProfiles (respondToAppointmentRequestAction เทียบกับ lawyerProfileId)
            lawyerUserId: lawyer.userId,    // uid ทนาย — ใช้ใน firestore.rules (get/update)
            lawyerName: lawyer.name ?? '',
            appointmentDate: ts,
            date: ts,                       // แดชบอร์ดลูกความ / lawslane-admin อ่านฟิลด์ date
            description,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await db.collection('notifications').add({
            type: 'appointment',
            title: 'คำขอนัดหมายใหม่',
            message: description.length > 100 ? description.slice(0, 100) + '...' : description,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
            recipient: lawyer.userId,
            link: `/lawyer-dashboard/request/${ref.id}`,
            relatedId: ref.id,
        });

        return { ok: true, appointmentId: ref.id };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.status === 401 ? 'กรุณาเข้าสู่ระบบก่อน' : e.message };
        console.error('requestAppointmentAction failed:', e);
        return { ok: false, error: 'ส่งคำขอนัดหมายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
    }
}
