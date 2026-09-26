import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getApprovedInterpretersAction } from '@/app/actions/interpreter-directory-actions';
import { InterpretersPageClient } from './interpreters-page-client';

// รายชื่อเหมือนกันทุกคน (ตัวกรองทำฝั่ง client) — cache แล้ว revalidate เป็นระยะแบบหน้า /lawyers
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Interpreters' });
    return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function InterpretersPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const interpreters = await getApprovedInterpretersAction();
    return (
        <Suspense fallback={null}>
            <InterpretersPageClient interpreters={interpreters} />
        </Suspense>
    );
}
