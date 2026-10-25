import type { Metadata } from 'next';
import { Cookie } from 'lucide-react';
import { setRequestLocale } from 'next-intl/server';
import { LegalDocument } from '@/components/legal/legal-document';
import { COOKIES } from '@/content/legal/cookies';
import { toLegalLocale } from '@/content/legal/meta';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    return { title: `${COOKIES[toLegalLocale(locale)].title} | Lawslane` };
}

export default async function CookiePolicyPage({ params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const l = toLegalLocale(locale);
    return <LegalDocument doc={COOKIES[l]} locale={l} icon={Cookie} current="cookies" />;
}
