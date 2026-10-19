import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShieldAlert, FileText, Search, Landmark } from 'lucide-react';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { getRegistryStats } from '@/lib/verified-lawyers-server';
import { VerifyLawyerClient } from './verify-lawyer-client';

// จำนวนรายชื่อ/วันที่อัปเดตในทะเบียนคำนวณที่ server — รีเฟรชทุกชั่วโมง
export const revalidate = 3600;

const FAQ_COUNT = 6;
const WARNING_COUNT = 5;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    return pageMetadata(locale, 'verifyLawyer', '/verify-lawyer');
}

// หัวเรื่อง วิธีตรวจสอบ และ FAQ เรนเดอร์ฝั่ง server ให้ Google เห็นเนื้อหาจริง
// เฉพาะฟอร์มค้นหา/ผลลัพธ์เป็น client component
export default async function VerifyLawyerPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations({ locale, namespace: 'VerifyLawyer' });
    const seo = await getTranslations({ locale, namespace: 'Seo' });
    const stats = await getRegistryStats();

    const faqs = Array.from({ length: FAQ_COUNT }, (_, i) => ({
        q: t(`guide.faq${i + 1}Q`),
        a: t(`guide.faq${i + 1}A`),
    }));
    const warnings = Array.from({ length: WARNING_COUNT }, (_, i) => t(`guide.warning${i + 1}`));
    const steps = [
        { icon: FileText, title: t('guide.step1Title'), body: t('guide.step1Body') },
        { icon: Search, title: t('guide.step2Title'), body: t('guide.step2Body') },
        { icon: Landmark, title: t('guide.step3Title'), body: t('guide.step3Body') },
    ];

    const pageUrl = `${SITE_URL}/${locale}/verify-lawyer`;
    // ไม่มีชื่อ/เลขทนายรายคนใน JSON-LD — มีแค่ข้อมูลของหน้า
    const jsonLd = [
        {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: seo('verifyLawyer.title'),
            description: seo('verifyLawyer.description'),
            url: pageUrl,
            inLanguage: locale,
        },
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Lawslane', item: `${SITE_URL}/${locale}` },
                { '@type': 'ListItem', position: 2, name: `${t('title')}${t('titleLine2')}`, item: pageUrl },
            ],
        },
        {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
        },
    ];

    return (
        <div className="min-h-screen bg-[#F4F6F9] relative overflow-hidden">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
            />

            {/* hero (ภาพ + หัวเรื่อง + ฟอร์มค้นหา) และผลค้นหาอยู่ใน client component */}
            <VerifyLawyerClient
                registryCount={stats.count}
                lastUpdatedIso={stats.lastUpdated}
                heading={
                    <>
                        <h1 className="font-headline leading-tight">
                            <span className="block text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter text-white">Lawslane</span>{' '}
                            <span className="block mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white text-balance">
                                {t('title')}{locale === 'en' ? ' ' : ''}{t('titleLine2')}
                            </span>
                        </h1>
                        <p className="text-gray-400 text-base md:text-lg lg:text-xl leading-relaxed max-w-[550px] mx-auto lg:mx-0">
                            {t('description')}
                        </p>
                    </>
                }
            />

            <div className="container mx-auto max-w-6xl px-4 md:px-8 relative z-10">
                {/* วิธีตรวจสอบ */}
                <section className="max-w-4xl mx-auto mt-6">
                    <h2 className="text-2xl md:text-3xl font-bold text-[#0B3979] text-center mb-6">{t('guide.heading')}</h2>
                    <ol className="grid gap-4 md:grid-cols-3">
                        {steps.map((step, i) => (
                            <li key={step.title} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="w-8 h-8 rounded-full bg-[#0B3979] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                                    <step.icon className="w-5 h-5 text-[#0B3979]" />
                                    <h3 className="font-semibold text-slate-800">{step.title}</h3>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed">{step.body}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* สัญญาณเตือน */}
                <section className="max-w-4xl mx-auto mt-10">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                        <h2 className="text-xl md:text-2xl font-bold text-amber-900 flex items-center gap-2 mb-4">
                            <ShieldAlert className="w-6 h-6" />
                            {t('guide.warningHeading')}
                        </h2>
                        <ul className="space-y-2 list-disc pl-6 text-amber-900/90">
                            {warnings.map((w) => (
                                <li key={w}>{w}</li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* FAQ */}
                <section className="max-w-4xl mx-auto mt-10 pb-12">
                    <h2 className="text-2xl md:text-3xl font-bold text-[#0B3979] text-center mb-6">{t('guide.faqHeading')}</h2>
                    <div className="space-y-3">
                        {faqs.map((f) => (
                            <details key={f.q} className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                                <summary className="cursor-pointer font-semibold text-slate-800 list-none flex justify-between items-center gap-4">
                                    <h3>{f.q}</h3>
                                    <span className="text-[#0B3979] transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                                </summary>
                                <p className="mt-3 text-slate-600 leading-relaxed">{f.a}</p>
                            </details>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
