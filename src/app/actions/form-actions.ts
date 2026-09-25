'use server';

import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { checkUpstashRateLimit, formRateLimiter } from '@/lib/upstash-ratelimit';
import { headers } from 'next/headers';

async function getIpFromHeaders() {
  const headersList = await headers();
  // Try Vercel specific header first
  const vercelIp = headersList.get('x-real-ip');
  if (vercelIp) return vercelIp;
  
  // Try standard forwarded for
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  return 'anonymous';
}

/**
 * ฟอร์มสาธารณะสองตัวด้านล่างเปิดให้คนที่ยังไม่ล็อกอินส่งได้โดยตั้งใจ (ด่านคือ rate limit ต่อ IP)
 * แต่เดิม `...formData` เขียนทุกฟิลด์ที่ผู้เรียกส่งมาลง Firestore — ใส่ฟิลด์แปลกๆ / ข้อความ
 * ขนาดใหญ่ได้ไม่จำกัด ตอนนี้เก็บเฉพาะฟิลด์ที่ฟอร์มมีจริงและตัดความยาว
 *
 * เขียนผ่าน Admin SDK — เดิมใช้ client SDK ฝั่ง server (ไม่ได้ล็อกอิน) ซึ่งทำงานได้ก็เพราะ
 * firestore.rules เปิด `create: if true` ไว้ แปลว่าใครก็ข้าม action นี้ (และ rate limit / การตัดฟิลด์)
 * ไปยิง addDoc ตรงได้ ตอนนี้ registrationRequests ปิด create จาก client แล้ว
 * (smeRequests ยังเปิดแบบ allowlist ให้ฟอร์มของ repo อื่นที่ยังเขียนตรงจาก client)
 */
async function getAdminDb() {
  const adminApp = await initAdmin();
  if (!adminApp) throw new Error('Firebase Admin not initialized');
  return adminApp.firestore();
}
function str(v: unknown, max: number) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export async function submitSmeRequestAction(formData: {
  name: string;
  phone: string;
  email: string;
  serviceType: string;
  fileUrl: string;
  fileName: string;
}) {
  // 1. Rate Limiting Check (5 per minute per IP)
  const ip = await getIpFromHeaders();
  const rateLimit = await checkUpstashRateLimit(ip, formRateLimiter);
  
  if (!rateLimit.success) {
    console.warn(`[SME Form] Rate limit exceeded for IP: ${ip}`);
    throw new Error('TOO_MANY_REQUESTS');
  }

  // 2. Validate input
  if (!formData.name || !formData.phone || !formData.email || !formData.serviceType) {
    throw new Error('Missing required fields');
  }

  try {
    const db = await getAdminDb();

    const docRef = await db.collection('smeRequests').add({
      name: str(formData.name, 200),
      phone: str(formData.phone, 50),
      email: str(formData.email, 254),
      serviceType: str(formData.serviceType, 100),
      fileUrl: str(formData.fileUrl, 1000),
      fileName: str(formData.fileName, 300),
      status: 'new',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: ip, // Save IP for audit/spam tracking
    });

    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error saving SME request:", error);
    throw new Error("Failed to save request");
  }
}

export async function submitRegistrationRequestAction(formData: {
  contactName: string;
  companyName: string;
  phone: string;
  email: string;
  registrationType: string;
  details: string;
}) {
  // 1. Rate Limiting Check (5 per minute per IP)
  const ip = await getIpFromHeaders();
  const rateLimit = await checkUpstashRateLimit(ip, formRateLimiter);
  
  if (!rateLimit.success) {
    console.warn(`[Registration Form] Rate limit exceeded for IP: ${ip}`);
    throw new Error('TOO_MANY_REQUESTS');
  }

  // 2. Validate input
  if (!formData.contactName || !formData.companyName || !formData.phone || !formData.email || !formData.registrationType) {
    throw new Error('Missing required fields');
  }

  try {
    const db = await getAdminDb();

    const docRef = await db.collection('registrationRequests').add({
      contactName: str(formData.contactName, 200),
      companyName: str(formData.companyName, 300),
      phone: str(formData.phone, 50),
      email: str(formData.email, 254),
      registrationType: str(formData.registrationType, 100),
      details: str(formData.details, 5000),
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: ip, // Save IP for audit/spam tracking
    });

    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error saving Registration request:", error);
    throw new Error("Failed to save request");
  }
}
