'use server';

import { initAdmin } from '@/lib/firebase-admin';
import { requireLawyer } from '@/lib/auth-guard';
import { uploadToR2 } from '@/app/actions/upload';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export interface VaultDoc {
    id: string;
    name: string;
    caseTitle: string;
    fileUrl: string;
    fileType: string;
    size: number;
    shareEnabled: boolean;
    shareToken: string | null;
    hasPassword: boolean;
    createdAt: number;
}

function hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/**
 * คลังเอกสารคดีของทนาย — เดิม lawyer-dashboard/vault/page.tsx ใช้ INITIAL_DOCS hardcode
 * ไม่มีการอัปโหลดจริง และปุ่ม "แชร์ให้ลูกความ" สร้างลิงก์ `/s/case-vault/{id}` ที่ไม่มีหน้าจริงรองรับ (404)
 * เก็บเป็น collection ระดับบนสุด `vaultDocs` (ไม่ใช่ subcollection ของ lawyerProfiles) เพื่อให้
 * ค้นหาด้วย shareToken ตรงๆ ได้โดยไม่ต้องพึ่ง collection-group index
 */
export async function getVaultDocsAction(): Promise<VaultDoc[]> {
    const { lawyerProfileId, adminApp } = await requireLawyer();
    const db = adminApp.firestore();

    const snap = await db.collection('vaultDocs')
        .where('lawyerId', '==', lawyerProfileId)
        .orderBy('createdAt', 'desc')
        .get();

    return snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            name: data.name,
            caseTitle: data.caseTitle || '',
            fileUrl: data.fileUrl,
            fileType: data.fileType,
            size: data.size || 0,
            shareEnabled: !!data.shareEnabled,
            shareToken: data.shareToken || null,
            hasPassword: !!data.passwordHash,
            createdAt: data.createdAt,
        };
    });
}

export async function uploadVaultDocAction(formData: FormData) {
    const { lawyerProfileId, adminApp } = await requireLawyer();
    const db = adminApp.firestore();

    const name = String(formData.get('name') || '').trim();
    const caseTitle = String(formData.get('caseTitle') || '').trim();
    const file = formData.get('file') as File | null;

    if (!name || !file) {
        return { success: false, error: 'กรุณาระบุชื่อเอกสารและเลือกไฟล์' };
    }

    try {
        const fileUrl = await uploadToR2(formData, `lawyer_documents/${lawyerProfileId}`);
        const docRef = await db.collection('vaultDocs').add({
            lawyerId: lawyerProfileId,
            name,
            caseTitle,
            fileUrl,
            fileType: file.type || 'application/octet-stream',
            size: file.size,
            shareEnabled: false,
            shareToken: null,
            passwordHash: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        return { success: true, id: docRef.id };
    } catch (error: any) {
        console.error('Error uploading vault doc:', error);
        return { success: false, error: error.message || 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
    }
}

async function requireVaultDocOwner(docId: string) {
    const { lawyerProfileId, adminApp } = await requireLawyer();
    const db = adminApp.firestore();
    const docSnap = await db.collection('vaultDocs').doc(docId).get();
    if (!docSnap.exists || docSnap.data()?.lawyerId !== lawyerProfileId) {
        throw new Error('ไม่พบเอกสาร หรือคุณไม่มีสิทธิ์เข้าถึง');
    }
    return { db, docSnap };
}

export async function deleteVaultDocAction(docId: string) {
    try {
        const { db } = await requireVaultDocOwner(docId);
        await db.collection('vaultDocs').doc(docId).delete();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * เปิด/ปิดการแชร์เอกสาร + ตั้ง/ล้างรหัสผ่าน — คืน shareToken ปัจจุบันให้ UI สร้างลิงก์
 * (ลิงก์จริง: /{locale}/vault/share/{token} — ของเดิมใช้ /s/case-vault/{id} ที่ไม่มีหน้ารองรับ)
 */
export async function updateVaultDocShareAction(docId: string, opts: { shareEnabled: boolean; password?: string | null }) {
    try {
        const { db, docSnap } = await requireVaultDocOwner(docId);
        const existingToken = docSnap.data()?.shareToken as string | null;

        const updates: Record<string, unknown> = {
            shareEnabled: opts.shareEnabled,
            updatedAt: Date.now(),
        };

        if (opts.shareEnabled && !existingToken) {
            updates.shareToken = uuidv4();
        }

        if (opts.password) {
            updates.passwordHash = hashPassword(opts.password);
        } else if (opts.password === null) {
            updates.passwordHash = null;
        }

        await db.collection('vaultDocs').doc(docId).update(updates);
        const finalToken = (updates.shareToken as string) || existingToken;
        return { success: true, shareToken: finalToken };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * เข้าถึงเอกสารที่แชร์ผ่านลิงก์สาธารณะ — ไม่ต้องล็อกอิน (ลูกความเปิดจากลิงก์ที่ทนายส่งให้)
 * ถ้าตั้งรหัสผ่านไว้ ต้องส่ง password มาถูกต้องก่อนถึงจะได้ fileUrl กลับไป
 */
export async function getSharedVaultDocAction(token: string, password?: string) {
    const adminApp = await initAdmin();
    if (!adminApp) return { success: false, error: 'Internal Server Error' };
    const db = adminApp.firestore();

    const snap = await db.collection('vaultDocs').where('shareToken', '==', token).limit(1).get();
    if (snap.empty) {
        return { success: false, error: 'ไม่พบเอกสาร หรือลิงก์นี้ถูกยกเลิกการแชร์แล้ว' };
    }

    const data = snap.docs[0].data();
    if (!data.shareEnabled) {
        return { success: false, error: 'เอกสารนี้ถูกยกเลิกการแชร์แล้ว' };
    }

    if (data.passwordHash) {
        if (!password || !verifyPassword(password, data.passwordHash)) {
            return { success: false, requiresPassword: true, error: password ? 'รหัสผ่านไม่ถูกต้อง' : undefined };
        }
    }

    return {
        success: true,
        name: data.name as string,
        fileUrl: data.fileUrl as string,
        fileType: data.fileType as string,
    };
}
