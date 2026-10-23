import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { setRequestLocale } from 'next-intl/server';
import { LegalDocument } from '@/components/legal/legal-document';
import { TERMS } from '@/content/legal/terms';
import { toLegalLocale } from '@/content/legal/meta';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    return { title: `${TERMS[toLegalLocale(locale)].title} | Lawslane` };
}

export default async function TermsOfServicePage({ params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const l = toLegalLocale(locale);
    return <LegalDocument doc={TERMS[l]} locale={l} icon={FileText} current="terms" />;
}
