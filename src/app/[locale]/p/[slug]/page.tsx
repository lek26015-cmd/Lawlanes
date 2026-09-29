import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import LandingPageView from '@/components/landing/landing-page-view';
import { getPublishedLanding } from '@/lib/landing-page-server';
import { SITE_URL } from '@/lib/seo';

/**
 * หน้า landing page สาธารณะ — เดิมเป็น client component ที่อ่าน Firestore หลังเปิดหน้า
 * (ไม่มี metadata / OG ตอนแชร์ลิงก์) ตอนนี้อ่านผ่าน Admin SDK บน server
 * ทั้งหน้าที่แอดมินสร้าง และหน้าของทนาย (แพลน Pro/บริษัท) — ดู src/lib/landing-page-server.ts
 */

type Props = { params: Promise<{ slug: string; locale: string }> };

// บันทึกจากหน้าแก้ไขสั่ง revalidatePath ทันที · 10 นาทีเผื่อแพลนหมดอายุ/แอดมินระงับ
export const revalidate = 600;

const load = cache((slug: string) => getPublishedLanding(decodeURIComponent(slug).toLowerCase()));

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, locale } = await props.params;
    const found = await load(slug);
    if (!found || !('data' in found)) return { title: 'Page Not Found - Lawslane', robots: { index: false, follow: false } };

    const d = found.data;
    const title = d.kind === 'lawyer' ? `${d.page.title} - ทนายความ | Lawslane` : `${d.page.title} | Lawslane`;
    const description = (d.kind === 'lawyer'
        ? d.page.tagline || d.page.sections.about.text || d.lawyer.description
        : d.page.content
    ).slice(0, 160);
    const image = d.kind === 'lawyer' ? d.page.heroImage || d.lawyer.imageUrl : d.page.heroImage;
    const url = `${SITE_URL}/${locale}/p/${slug}`;

    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: { title, description, url, type: 'profile', images: image ? [{ url: image }] : undefined },
        twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : undefined },
    };
}

export default async function PublicLandingPage(props: Props) {
    const { slug, locale } = await props.params;
    const found = await load(slug);
    if (!found) notFound();
    if ('redirect' in found) redirect(`/${locale}${found.redirect}`);
    return <LandingPageView data={found.data} locale={locale} />;
}
