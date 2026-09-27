import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, ShieldAlert, FileText, Search, Landmark } from 'lucide-react';
import { Link } from '@/navigation';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { VerifyLawyerClient } from './verify-lawyer-client';

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
        <div className="min-h-screen bg-[#F4F6F9] p-4 md:p-8 relative overflow-hidden">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
            />

            {/* Decorative Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-blue-100/50 blur-3xl animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[30%] rounded-full bg-indigo-100/50 blur-3xl" />
            </div>

            <div className="container mx-auto max-w-6xl relative z-10">
                {/* Header Section */}
                <div className="mb-8 pt-4 md:pt-8">
                    <Link href="/" className="inline-flex items-center text-sm text-slate-500 hover:text-[#0B3979] transition-colors mb-6 font-medium">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {t('backToHome')}
                    </Link>

                    <div className="text-center space-y-4 mb-8">
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight font-headline text-[#0B3979] leading-tight">
                            {t('title')}<br />{t('titleLine2')}
                        </h1>
                        <p className="text-slate-500 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
                            {t('description')}
                        </p>
                    </div>
                </div>

                <VerifyLawyerClient />

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
