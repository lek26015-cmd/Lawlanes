'use server';

import { Resend } from 'resend';
import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';

/** How many days a verification link stays valid */
const VERIFICATION_LINK_EXPIRY_DAYS = 7;

// Helper function to generate premium HTML email
function generateEmailHtml(title: string, content: string, buttonText: string, link: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f9; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #0B3979; text-decoration: none; letter-spacing: -0.5px; }
        .card { background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
        .title { color: #1e293b; font-size: 24px; font-weight: bold; margin-top: 0; margin-bottom: 20px; text-align: center; }
        .text { color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
        .button-container { text-align: center; margin: 32px 0; }
        .button { background-color: #0B3979; color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(11, 57, 121, 0.2); transition: background-color 0.2s; }
        .button:hover { background-color: #082a5a; }
        .link-text { font-size: 14px; color: #94a3b8; word-break: break-all; text-align: center; margin-top: 24px; }
        .link-text a { color: #0B3979; text-decoration: none; }
        .footer { text-align: center; margin-top: 30px; color: #94a3b8; font-size: 12px; }
        .footer p { margin: 8px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="https://lawslane.com" class="logo">Lawslane</a>
        </div>
        <div class="card">
          <h1 class="title">${title}</h1>
          <div class="text">
            ${content}
          </div>
          <div class="button-container">
            <a href="${link}" class="button">${buttonText}</a>
          </div>
          <div class="link-text">
            หรือคลิกลิงก์นี้:<br>
            <a href="${link}">${link}</a>
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Lawslane. All rights reserved.</p>
          <p>อีเมลนี้เป็นการแจ้งเตือนอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendCustomVerificationEmail(email: string, name: string) {
  try {
    const app = await initAdmin();
    if (!app) {
      const errorMsg = 'ระบบไม่สามารถเชื่อมต่อ Server ทางเลือกได้ในขณะนี้'
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Look up the user by email to get their UID
    const userRecord = await admin.auth().getUserByEmail(email);

    // Generate a secure random token
    const token = randomBytes(32).toString('hex');

    // Calculate expiry date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + VERIFICATION_LINK_EXPIRY_DAYS);

    // Store the token in Firestore
    const db = admin.firestore();
    await db.collection('email_verification_tokens').doc(token).set({
      uid: userRecord.uid,
      email,
      name,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Build the verification link pointing to our custom API route
    const link = `https://lawslane.com/api/auth/verify-email?token=${token}`;

    const emailHtml = generateEmailHtml(
      `ยินดีต้อนรับคุณ ${name}`,
      `ขอบคุณที่ลงทะเบียนกับ Lawslane<br>กรุณายืนยันที่อยู่อีเมลของคุณเพื่อเริ่มต้นใช้งาน<br><br><small style="color:#94a3b8;">ลิงก์นี้จะหมดอายุใน ${VERIFICATION_LINK_EXPIRY_DAYS} วัน</small>`,
      'ยืนยันอีเมล',
      link
    );

    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: 'Lawslane <contact@lawslane.com>',
      to: email,
      subject: 'ยินดีต้อนรับสู่ Lawslane - กรุณายืนยันอีเมลของคุณ',
      html: emailHtml
    });

    if (result.error) {
      console.error('Error sending verification email with Resend:', result.error);
      return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error creating custom verification email:', error);
    return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}

export async function sendCustomPasswordResetEmailV2(email: string) {
  try {
    const auth = await initAdmin();
    if (!auth) {
      return { success: false, error: 'ระบบทำงานผิดพลาด กำลังแก้ไขโดยเร็วที่สุด' };
    }

    const actionCodeSettings = {
      url: `https://lawslane.com/login`,
    };

    const link = await auth.auth().generatePasswordResetLink(email, actionCodeSettings);

    const emailHtml = generateEmailHtml(
      'รีเซ็ตรหัสผ่าน',
      `เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีที่เชื่อมโยงกับอีเมลนี้<br>คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่`,
      'รีเซ็ตรหัสผ่าน',
      link
    );

    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: 'Lawslane <contact@lawslane.com>',
      to: email,
      subject: 'รีเซ็ตรหัสผ่านบัญชี Lawslane ของคุณ',
      html: emailHtml
    });

    if (result.error) {
      console.error('Error sending reset email with Resend:', result.error);
      return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in custom password reset:', error);
    return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}
