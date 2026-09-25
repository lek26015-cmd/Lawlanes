'use server';

import { NotificationService } from "@/services/notification-service";
import { requireUser, AuthError } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/security/rate-limiter';

function escapeHtml(v: string) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/**
 * แจ้งแอดมินว่ามีทนายสมัครใหม่ — หน้า lawyer-signup / for-lawyers เรียกหลังสร้างโปรไฟล์แล้ว
 *
 * เดิมด่านมีแค่ requireUser() แล้วใส่ name/email ที่ผู้เรียกส่งมาลงอีเมล HTML ถึงแอดมินทุกคนตรงๆ
 * → ผู้ใช้คนไหนก็ยิงวนให้กล่องแอดมินท่วม และแทรก HTML/ลิงก์ลงอีเมลที่แอดมินเชื่อถือได้
 * ตอนนี้: ต้องมีโปรไฟล์ทนายของตัวเองอยู่จริง · ชื่อ/อีเมลอ่านจากโปรไฟล์ฝั่ง server
 * (พารามิเตอร์คงไว้ให้ผู้เรียกเดิม แต่ไม่ใช้) · จำกัดความถี่ต่อบัญชี
 */
export async function notifyAdminNewLawyerAction(_name?: string, _email?: string) {
  try {
    const { uid, adminApp } = await requireUser();
    const db = adminApp.firestore();

    let profile = (await db.collection('lawyerProfiles').doc(uid).get()).data();
    if (!profile) {
      const q = await db.collection('lawyerProfiles').where('userId', '==', uid).limit(1).get();
      profile = q.empty ? undefined : q.docs[0].data();
    }
    if (!profile) return { success: false, error: 'ไม่พบโปรไฟล์ทนายความของบัญชีนี้' };

    const limit = await checkRateLimit(`notify-admin-new-lawyer:${uid}`, 2, 60 * 60 * 1000);
    if (!limit.success) return { success: false, error: 'ส่งแจ้งเตือนบ่อยเกินไป' };

    return await NotificationService.notifyAdminNewLawyer(
      escapeHtml(String(profile.name || 'ไม่ระบุชื่อ').slice(0, 100)),
      profile.email ? escapeHtml(String(profile.email).slice(0, 254)) : undefined
    );
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Error in notifyAdminNewLawyerAction:", error);
    return { success: false, error: "Failed to send notification" };
  }
}

// notifyLawyerNewChatAction ถูกลบออก — รับ lawyerEmail / lawyerLineId / ข้อความ จากผู้เรียก
// ทั้งหมด (ด่านมีแค่ requireUser) = ส่งอีเมล/LINE ในนาม Lawslane ไปหาใครก็ได้
// และไม่มีโค้ดส่วนไหนเรียกใช้ (แจ้งเตือนแชทใหม่ส่งจาก sendChatMessageAction ฝั่ง server แล้ว)
