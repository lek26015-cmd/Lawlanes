'use server';

/**
 * Landing page ของทนาย — ดู src/lib/landing-page.ts
 * ตัวตนมาจาก session (requireLawyer) เท่านั้น ทนายแก้ได้เฉพาะหน้าของตัวเอง (doc id ผูกกับ lawyerProfileId)
 * แก้/เก็บแบบร่างได้ทุกแพลน · เผยแพร่ได้เฉพาะแพลนที่มีสิทธิ์ personalSite (ค่าเริ่มต้น Pro/บริษัท) และทนายที่อนุมัติแล้ว
 */

import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { requireLawyer, authErrorResult } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { lawyerTier, type PlanTier } from '@/lib/provider-plans';
import { getLawyerPlanConfig } from '@/lib/lawyer-plan-access';
import { getPublicLawyerAction, type PublicLawyer } from '@/app/actions/lawyer-directory-actions';
import { uploadToCloudflareImages } from '@/app/actions/upload';
import { LANDING_LIMITS, normalizeSlug, sanitizeLandingInput, slugError, type LawyerLandingInput } from '@/lib/landing-page';
import { landingDocId, toLawyerLanding } from '@/lib/landing-page-server';

type Result<T = {}> = ({ success: true } & T) | { success: false; error: string };

async function slugTaken(db: FirebaseFirestore.Firestore, slug: string, ownDocId: string) {
    const snap = await db.collection('landingPages').where('slug', '==', slug).limit(2).get();
    return snap.docs.some(d => d.id !== ownDocId);
}

export async function getMyLandingPageAction(): Promise<Result<{
    page: LawyerLandingInput | null;
    suspended: boolean;
    tier: PlanTier;
    /** แพลนนี้มีสิทธิ์เผยแพร่หน้าเว็บส่วนตัว (แอดมินปรับได้ — ดู lib/lawyer-entitlements) */
    canPublishSite: boolean;
    lawyer: PublicLawyer | null;
}>> {
    try {
        const { lawyerProfileId, adminApp } = await requireLawyer();
        const db = adminApp.firestore();
        const [pageSnap, profileSnap, lawyer, config] = await Promise.all([
            db.collection('landingPages').doc(landingDocId(lawyerProfileId)).get(),
            db.collection('lawyerProfiles').doc(lawyerProfileId).get(),
            getPublicLawyerAction(lawyerProfileId),
            getLawyerPlanConfig(db),
        ]);
        const tier = lawyerTier(profileSnap.data());
        return {
            success: true,
            page: pageSnap.exists ? toLawyerLanding(pageSnap.data() || {}) : null,
            suspended: pageSnap.get('suspended') === true,
            tier,
            canPublishSite: config[tier].personalSite,
            lawyer,
        };
    } catch (e) {
        return authErrorResult(e);
    }
}

export async function checkLandingSlugAction(raw: string): Promise<Result<{ slug: string; available: boolean; reason?: string }>> {
    try {
        const { lawyerProfileId, adminApp } = await requireLawyer();
        const slug = normalizeSlug(raw);
        const err = slugError(slug);
        if (err) return { success: true, slug, available: false, reason: err };
        const taken = await slugTaken(adminApp.firestore(), slug, landingDocId(lawyerProfileId));
        return { success: true, slug, available: !taken, reason: taken ? 'ชื่อลิงก์นี้มีผู้ใช้แล้ว' : undefined };
    } catch (e) {
        return authErrorResult(e);
    }
}

export async function saveMyLandingPageAction(input: unknown): Promise<Result<{ slug: string; status: 'published' | 'draft' }>> {
    try {
        const { uid, lawyerProfileId, adminApp } = await requireLawyer();
        const limit = await checkRateLimit(`landing-save:${uid}`, 20, 10 * 60 * 1000);
        if (!limit.success) return { success: false, error: 'บันทึกถี่เกินไป กรุณารอสักครู่' };

        const parsed = sanitizeLandingInput(input);
        if (!parsed.ok) return { success: false, error: parsed.error };
        const value = parsed.value;

        const db = adminApp.firestore();
        const ref = db.collection('landingPages').doc(landingDocId(lawyerProfileId));

        if (value.status === 'published') {
            const profile = await db.collection('lawyerProfiles').doc(lawyerProfileId).get();
            if (profile.get('status') !== 'approved') {
                return { success: false, error: 'เผยแพร่ได้หลังบัญชีทนายได้รับการอนุมัติแล้ว' };
            }
            const config = await getLawyerPlanConfig(db);
            if (!config[lawyerTier(profile.data())].personalSite) {
                return { success: false, error: 'แพลนปัจจุบันของคุณยังไม่รวมการเผยแพร่หน้าเว็บส่วนตัว — บันทึกเป็นแบบร่างไว้ก่อนได้' };
            }
        }

        const previousSlug = await db.runTransaction(async tx => {
            const existing = await tx.get(ref);
            if (existing.get('suspended') === true && value.status === 'published') {
                throw new Error('SUSPENDED');
            }
            const dup = await tx.get(db.collection('landingPages').where('slug', '==', value.slug).limit(2));
            if (dup.docs.some(d => d.id !== ref.id)) throw new Error('SLUG_TAKEN');

            // เขียนทับทั้งเอกสาร (ไม่ merge) — merge จะเก็บ key ที่ทนายลบออกแล้วไว้ใน map
            // (เช่น เบอร์โทรใน contactInfo หรือชื่อหัวข้อที่รีเซ็ตกลับค่าเดิม) · คงค่าที่ทนายแก้ไม่ได้ไว้เอง
            tx.set(ref, {
                ...value,
                // หลังบ้านแอดมินและหน้า /p ของ capdeal อ่าน `content` — ใส่ข้อความแนะนำตัวไว้ให้แสดงได้
                content: value.sections.about.text,
                ownerType: 'lawyer',
                lawyerId: lawyerProfileId,
                suspended: existing.get('suspended') === true,
                createdAt: existing.get('createdAt') ?? FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            return (existing.get('slug') as string | undefined) || null;
        });

        revalidatePath(`/[locale]/p/${value.slug}`, 'page');
        if (previousSlug && previousSlug !== value.slug) revalidatePath(`/[locale]/p/${previousSlug}`, 'page');
        return { success: true, slug: value.slug, status: value.status };
    } catch (e: any) {
        if (e?.message === 'SLUG_TAKEN') return { success: false, error: 'ชื่อลิงก์นี้มีผู้ใช้แล้ว กรุณาเลือกชื่ออื่น' };
        if (e?.message === 'SUSPENDED') return { success: false, error: 'หน้านี้ถูกระงับโดยผู้ดูแลระบบ กรุณาติดต่อฝ่ายสนับสนุน' };
        return authErrorResult(e);
    }
}

/** อัปโหลดรูปของหน้า (ปก/โลโก้/โปรไฟล์/ทีมงาน/แกลเลอรี) ขึ้น Cloudflare Images — รับเฉพาะรูป ≤ 5MB */
export async function uploadLandingImageAction(formData: FormData): Promise<Result<{ url: string }>> {
    try {
        const { uid } = await requireLawyer();
        const limit = await checkRateLimit(`landing-image:${uid}`, 30, 60 * 60 * 1000);
        if (!limit.success) return { success: false, error: 'อัปโหลดถี่เกินไป กรุณาลองใหม่ภายหลัง' };

        const file = formData.get('file');
        if (!(file instanceof File)) return { success: false, error: 'ไม่พบไฟล์' };
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            return { success: false, error: 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP' };
        }
        if (file.size > LANDING_LIMITS.imageBytes) return { success: false, error: 'ไฟล์ต้องมีขนาดไม่เกิน 5MB' };

        const url = await uploadToCloudflareImages(formData);
        return { success: true, url };
    } catch (e: any) {
        if (e?.name === 'AuthError') return authErrorResult(e);
        console.error('uploadLandingImageAction', e);
        return { success: false, error: 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่' };
    }
}
