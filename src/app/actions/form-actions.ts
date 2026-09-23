'use server';

import { initializeFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
 */
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
    const { firestore: db } = initializeFirebase();
    if (!db) throw new Error("Firestore not initialized");

    const docRef = await addDoc(collection(db, 'smeRequests'), {
      name: str(formData.name, 200),
      phone: str(formData.phone, 50),
      email: str(formData.email, 254),
      serviceType: str(formData.serviceType, 100),
      fileUrl: str(formData.fileUrl, 1000),
      fileName: str(formData.fileName, 300),
      status: 'new',
      createdAt: serverTimestamp(),
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
    const { firestore: db } = initializeFirebase();
    if (!db) throw new Error("Firestore not initialized");

    const docRef = await addDoc(collection(db, 'registrationRequests'), {
      contactName: str(formData.contactName, 200),
      companyName: str(formData.companyName, 300),
      phone: str(formData.phone, 50),
      email: str(formData.email, 254),
      registrationType: str(formData.registrationType, 100),
      details: str(formData.details, 5000),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ipAddress: ip, // Save IP for audit/spam tracking
    });

    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error saving Registration request:", error);
    throw new Error("Failed to save request");
  }
}
