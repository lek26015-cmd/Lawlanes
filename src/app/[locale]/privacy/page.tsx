import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { setRequestLocale } from 'next-intl/server';
import { LegalDocument } from '@/components/legal/legal-document';
import { PRIVACY } from '@/content/legal/privacy';
import { toLegalLocale } from '@/content/legal/meta';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    return { title: `${PRIVACY[toLegalLocale(locale)].title} | Lawslane` };
}

export default async function PrivacyPolicyPage({ params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const l = toLegalLocale(locale);
    return <LegalDocument doc={PRIVACY[l]} locale={l} icon={ShieldCheck} current="privacy" />;
}
