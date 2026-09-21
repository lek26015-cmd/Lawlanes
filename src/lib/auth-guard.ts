import 'server-only';
import { cookies, headers } from 'next/headers';
import { initAdmin } from './firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * ด่านตรวจสิทธิ์ฝั่ง server สำหรับแอปหลัก
 *
 * กติกาเดียวที่ต้องจำ: **ตัวตนมาจาก token เสมอ ห้ามรับ uid/role เป็น argument**
 * server action คือ POST endpoint จริง ใครก็ยิงเข้ามาได้ การรับ userId เป็น
 * พารามิเตอร์แล้วเชื่อเลย = IDOR ทันที
 *
 * ⚠️ อย่าใช้ middleware.ts เป็นด่านความปลอดภัย: มันอ่าน cookie `session_hint`
 *    และ `role_hint` ซึ่งตั้งด้วย httpOnly:false → ผู้ใช้แก้จาก console ได้เอง
 *    (ดูแผนความปลอดภัย §1 ข้อ 1.5) middleware ใช้ได้แค่เป็น UX redirect
 *
 * ⚠️ จงใจ "ไม่" อ่าน users/{uid}.role จาก Firestore เป็นเกณฑ์ admin:
 *    firestore.rules ปัจจุบันให้ผู้ใช้เขียน document ตัวเองได้ทุกฟิลด์ (§2 ข้อ 2.1)
 *    แหล่งความจริงของ role แอดมินคือ custom claim เท่านั้น
 */

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

type Session = {
  uid: string;
  token: DecodedIdToken;
  adminApp: NonNullable<Awaited<ReturnType<typeof initAdmin>>>;
};

/** ผู้เรียกต้องล็อกอินอยู่จริง — คืน uid ที่ผ่านการตรวจลายเซ็นแล้ว */
export async function requireUser(): Promise<Session> {
  const adminApp = await initAdmin();
  if (!adminApp) {
    throw new AuthError('Server misconfigured: Firebase Admin not initialized', 500);
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (sessionCookie) {
    try {
      // checkRevoked: true → บัญชีที่ถูกระงับใช้ต่อไม่ได้ ไม่ต้องรอ cookie หมดอายุ 5 วัน
      const token = await adminApp.auth().verifySessionCookie(sessionCookie, true);
      return { uid: token.uid, token, adminApp };
    } catch {
      // ตกไปลองทาง Bearer ต่อ
    }
  }

  const headersList = await headers();
  const authHeader = headersList.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = await adminApp.auth().verifyIdToken(authHeader.slice('Bearer '.length), true);
      return { uid: token.uid, token, adminApp };
    } catch {
      throw new AuthError('Unauthorized: invalid token', 401);
    }
  }

  throw new AuthError('Unauthorized: no valid session', 401);
}

/** ผู้เรียกต้องเป็นแอดมิน (custom claim เท่านั้น) */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (session.token.admin !== true && session.token.role !== 'admin') {
    throw new AuthError('Forbidden: admin access required', 403);
  }
  return session;
}

/** ผู้เรียกต้องเป็นเจ้าของ uid นั้น หรือเป็นแอดมิน — ใช้แทนการรับ userId มาเฉยๆ */
export async function requireSelfOrAdmin(targetUid: string): Promise<Session> {
  const session = await requireUser();
  const isAdmin = session.token.admin === true || session.token.role === 'admin';
  if (session.uid !== targetUid && !isAdmin) {
    throw new AuthError('Forbidden', 403);
  }
  return session;
}

/**
 * ผู้เรียกต้องเป็นทนาย — ยืนยันจาก lawyerProfiles ไม่ใช่จาก role ที่ client ส่งมา
 * คืน lawyerProfileId ที่ผูกกับบัญชีนี้จริง
 */
export async function requireLawyer(): Promise<Session & { lawyerProfileId: string }> {
  const session = await requireUser();
  if (session.token.lawyer === true && typeof session.token.lawyerProfileId === 'string') {
    return { ...session, lawyerProfileId: session.token.lawyerProfileId };
  }
  const snap = await session.adminApp
    .firestore()
    .collection('lawyerProfiles')
    .where('userId', '==', session.uid)
    .limit(1)
    .get();
  if (snap.empty) {
    throw new AuthError('Forbidden: lawyer access required', 403);
  }
  return { ...session, lawyerProfileId: snap.docs[0].id };
}

/** ตัวช่วยสำหรับ API route */
export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error('AUTH_GUARD_UNEXPECTED_ERROR', error);
  return Response.json({ error: 'Internal Server Error' }, { status: 500 });
}

/** ตัวช่วยสำหรับ server action ที่คืน { success, error } */
export function authErrorResult(error: unknown): { success: false; error: string } {
  if (error instanceof AuthError) {
    return { success: false, error: error.message };
  }
  console.error('AUTH_GUARD_UNEXPECTED_ERROR', error);
  return { success: false, error: 'Internal Server Error' };
}

/**
 * หาบทบาทจริงของผู้เรียกในแชท/เคสหนึ่งๆ จากข้อมูลใน Firestore
 *
 * ใช้แทนการรับ role เป็น argument — เดิม signContractAction() ให้ผู้เรียก
 * ประกาศเองว่าเป็น 'client' หรือ 'lawyer' ซึ่งแปลว่าเซ็นแทนอีกฝ่ายได้
 *
 * โครงสร้างข้อมูลแชทมีชื่อฟิลด์ปนกันหลายแบบ (clientId/userId/client_id,
 * lawyerId/lawyer_id) และ lawyerId เป็น id ของ lawyerProfiles ไม่ใช่ auth uid
 * จึงต้องตามไปอ่าน lawyerProfiles.userId อีกชั้น
 */
export async function requireChatRole(chatId: string): Promise<{
  uid: string;
  role: 'client' | 'lawyer' | 'admin';
  chatData: FirebaseFirestore.DocumentData;
  adminApp: NonNullable<Awaited<ReturnType<typeof initAdmin>>>;
}> {
  const { uid, token, adminApp } = await requireUser();
  const db = adminApp.firestore();

  const chatSnap = await db.collection('chats').doc(chatId).get();
  if (!chatSnap.exists) {
    throw new AuthError('Chat not found', 404);
  }
  const chatData = chatSnap.data() || {};

  if (token.admin === true || token.role === 'admin') {
    return { uid, role: 'admin', chatData, adminApp };
  }

  const clientId = chatData.clientId || chatData.userId || chatData.client_id || '';
  if (clientId && clientId === uid) {
    return { uid, role: 'client', chatData, adminApp };
  }

  const lawyerProfileId = chatData.lawyerId || chatData.lawyer_id || '';
  if (lawyerProfileId) {
    const lawyerSnap = await db.collection('lawyerProfiles').doc(lawyerProfileId).get();
    if (lawyerSnap.exists && lawyerSnap.data()?.userId === uid) {
      return { uid, role: 'lawyer', chatData, adminApp };
    }
  }

  throw new AuthError('Forbidden: not a party to this case', 403);
}
