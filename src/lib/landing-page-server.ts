import 'server-only';
import { initAdmin } from '@/lib/firebase-admin';
import { effectiveTier } from '@/lib/provider-plans';
import { getPublicLawyerAction, type PublicLawyer } from '@/app/actions/lawyer-directory-actions';
import { withLandingDefaults, type LawyerLandingInput } from '@/lib/landing-page';

export type LandingViewData =
    | { kind: 'lawyer'; page: LawyerLandingInput; lawyer: PublicLawyer }
    | {
          kind: 'legacy';
          page: {
              title: string;
              heroImage: string;
              logo?: string;
              themeColor: string;
              content: string;
              contactInfo: LawyerLandingInput['contactInfo'];
          };
      };

export type LandingLookup = { data: LandingViewData } | { redirect: string } | null;

export function landingDocId(lawyerProfileId: string) {
    return `lawyer_${lawyerProfileId}`;
}

/** รวมค่าที่เก็บไว้กับค่าตั้งต้น — เอกสารเก่า/ฟิลด์ที่ขาดไม่ทำให้หน้าพัง */
export function toLawyerLanding(d: FirebaseFirestore.DocumentData): LawyerLandingInput {
    // เอกสารใน Firestore ไม่ใช่ plain object (มี Timestamp) — ส่งเฉพาะฟิลด์ของหน้าเข้า withLandingDefaults
    const { createdAt, updatedAt, ownerType, lawyerId, content, suspended, ...rest } = d;
    return withLandingDefaults(rest);
}

/**
 * หน้าที่เผยแพร่แล้วตาม slug · หน้าของทนายต้องผ่าน 3 ด่านตอนแสดงผลทุกครั้ง:
 * ทนาย approved + แพลน Pro/บริษัทยังใช้ได้ + แอดมินไม่ได้ระงับหน้า
 * แพลนหมดอายุ → พาไปโปรไฟล์ปกติแทน (ลิงก์ที่ทนายแชร์ไว้ยังใช้ได้)
 */
export async function getPublishedLanding(slug: string): Promise<LandingLookup> {
    if (!slug || slug.length > 60 || slug.includes('/')) return null;
    const adminApp = await initAdmin();
    if (!adminApp) return null;
    const db = adminApp.firestore();

    const snap = await db.collection('landingPages')
        .where('slug', '==', slug)
        .where('status', '==', 'published')
        .limit(1)
        .get();
    if (snap.empty) return null;
    const d = snap.docs[0].data();

    if (d.ownerType !== 'lawyer') {
        return {
            data: {
                kind: 'legacy',
                page: {
                    title: d.title || '',
                    heroImage: d.heroImage || '',
                    logo: d.logo || undefined,
                    themeColor: d.themeColor || '#002f4b',
                    content: d.content || '',
                    contactInfo: d.contactInfo || {},
                },
            },
        };
    }

    if (d.suspended === true || typeof d.lawyerId !== 'string') return null;
    const lawyer = await getPublicLawyerAction(d.lawyerId);
    if (!lawyer || lawyer.status !== 'approved') return null;
    // planTier ของ PublicLawyer ผ่าน effectiveTier() มาแล้ว
    if ((lawyer.planTier || 'free') === 'free') {
        return { redirect: `/lawyers/${lawyer.id}` };
    }
    return { data: { kind: 'lawyer', page: toLawyerLanding(d), lawyer } };
}

/** slug ของหน้าทนายที่เปิดอยู่จริง — ใช้ทำ sitemap */
export async function listPublishedLawyerSlugs(max = 1000): Promise<string[]> {
    const adminApp = await initAdmin();
    if (!adminApp) return [];
    const snap = await adminApp.firestore().collection('landingPages')
        .where('ownerType', '==', 'lawyer')
        .where('status', '==', 'published')
        .limit(max)
        .get();
    const slugs: string[] = [];
    await Promise.all(snap.docs.map(async doc => {
        const d = doc.data();
        if (d.suspended === true || typeof d.lawyerId !== 'string') return;
        const l = await adminApp.firestore().collection('lawyerProfiles').doc(d.lawyerId).get();
        if (l.get('status') === 'approved' && l.get('hiddenFromDirectory') !== true && effectiveTier(l.get('plan')) !== 'free') slugs.push(d.slug);
    }));
    return slugs;
}
