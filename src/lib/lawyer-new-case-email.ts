import 'server-only';
import { Resend } from 'resend';

/**
 * อีเมลแจ้งทนายว่ามีคำขอปรึกษาใหม่ — เรียกจากฝั่ง server เท่านั้น (startConsultationAction)
 *
 * เดิมอยู่ใน app/actions/email.ts ซึ่งเป็นไฟล์ 'use server' → กลายเป็น endpoint สาธารณะ
 * ที่รับ อีเมลปลายทาง / ชื่อ / หัวข้อ / ลิงก์ ทั้งหมดจากผู้เรียก ด่านมีแค่ requireUser()
 * สมัครบัญชีฟรีหนึ่งบัญชีก็ใช้ส่งอีเมลหน้าตาทางการจาก noreply@lawslane.com พร้อมปุ่ม
 * ลิงก์ไปเว็บไหนก็ได้หาใครก็ได้ (phishing ในนาม Lawslane) — ย้ายมาเป็น server-only
 * และ escape ทุกค่าที่มาจากผู้ใช้ก่อนใส่ลง HTML
 */

function escapeHtml(v: string) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export async function sendLawyerNewCaseEmail(
  lawyerEmail: string,
  lawyerName: string,
  clientName: string,
  caseTitle: string,
  caseLink: string
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set. Skipping email notification.');
    return { success: false, error: 'Missing API Key' };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const safeLawyer = escapeHtml(lawyerName);
  const safeClient = escapeHtml(String(clientName ?? '').slice(0, 100));
  const safeTitle = escapeHtml(String(caseTitle ?? '').slice(0, 300));
  const safeLink = escapeHtml(caseLink);

  try {
    const { data, error } = await resend.emails.send({
      from: 'Lawslane <noreply@lawslane.com>',
      to: [lawyerEmail],
      // หัวเรื่องเป็น plain text ไม่ต้อง escape แต่ตัดความยาวกันยัดข้อความยาว
      subject: `[Lawslane] มีคดีใหม่จากคุณ ${String(clientName ?? '').slice(0, 100)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d;">เรียน ทนายความ ${safeLawyer}</h2>
          <p>มีลูกความท่านใหม่ต้องการปรึกษาคดีกับท่าน โดยมีรายละเอียดดังนี้:</p>
          
          <div style="background-color: #f7fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>ลูกความ:</strong> ${safeClient}</p>
            <p><strong>หัวข้อคดี:</strong> ${safeTitle}</p>
          </div>

          <p>ท่านสามารถกดปุ่มด้านล่างเพื่อเข้าสู่ห้องแชทและเริ่มให้คำปรึกษาได้ทันที:</p>
          
          <a href="${safeLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            เข้าสู่ห้องแชท
          </a>
          
          <p style="margin-top: 30px; font-size: 12px; color: #718096;">
            หากปุ่มใช้งานไม่ได้ สามารถคลิกที่ลิงก์นี้: <br>
            <a href="${safeLink}">${safeLink}</a>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend Error:', error);
      return { success: false, error: JSON.stringify(error) };
    }

    return { success: true, data: JSON.parse(JSON.stringify(data)) };
  } catch (error: any) {
    console.error('Email Sending Error:', error);
    return { success: false, error: error.message || 'Unknown email error' };
  }
}
