import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, ShieldCheck, Search, UserCheck } from 'lucide-react';
import { Link } from '@/navigation';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { NameRegistrationForm } from './name-registration-form';

const FAQ_COUNT = 5;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    return pageMetadata(locale, 'verifyLawyerRegister', '/verify-lawyer/register');
}

// ทนายลงทะเบียนชื่อ + เลขใบอนุญาต ให้ลูกความค้นเจอในหน้าตรวจสอบทนาย (ฟรี ไม่ต้องสมัครสมาชิก)
// แตกต่างจาก /lawyer-signup ที่สร้างโปรไฟล์รับงานเต็มรูปแบบ
export default async function VerifyLawyerRegisterPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations({ locale, namespace: 'LawyerNameRegistration' });

    const seo = await getTranslations({ locale, namespace: 'Seo' });
    const tVerify = await getTranslations({ locale, namespace: 'VerifyLawyer' });
    const faqs = Array.from({ length: FAQ_COUNT }, (_, i) => ({ q: t(`faq${i + 1}Q`), a: t(`faq${i + 1}A`) }));

    // JSON-LD แบบเดียวกับหน้า /verify-lawyer: ข้อมูลของหน้า + breadcrumb + FAQ (ไม่มีชื่อทนายรายคน)
    const pageUrl = `${SITE_URL}/${locale}/verify-lawyer/register`;
    const jsonLd = [
        {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: seo('verifyLawyerRegister.title'),
            description: seo('verifyLawyerRegister.description'),
            url: pageUrl,
            inLanguage: locale,
        },
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Lawslane', item: `${SITE_URL}/${locale}` },
                { '@type': 'ListItem', position: 2, name: `${tVerify('title')}${locale === 'en' ? ' ' : ''}${tVerify('titleLine2')}`, item: `${SITE_URL}/${locale}/verify-lawyer` },
                { '@type': 'ListItem', position: 3, name: t('title'), item: pageUrl },
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

    const steps = [
        { icon: UserCheck, title: t('step1Title'), body: t('step1Body') },
        { icon: ShieldCheck, title: t('step2Title'), body: t('step2Body') },
        { icon: Search, title: t('step3Title'), body: t('step3Body') },
    ];

    return (
        <div className="min-h-screen bg-[#F4F6F9]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
            />
            <section className="w-full bg-slate-900 text-white rounded-b-[60px] md:rounded-b-[80px]">
                <div className="max-w-3xl mx-auto px-4 md:px-8 pt-6 md:pt-8 pb-16 md:pb-20">
                    <Link href="/verify-lawyer" className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {t('back')}
                    </Link>
                    <div className="mt-8 space-y-4 text-center">
                        <span className="inline-block rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-semibold px-3 py-1">{t('badge')}</span>
                        <h1 className="font-headline text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance">{t('title')}</h1>
                        <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">{t('description')}</p>
                    </div>
                </div>
            </section>

            <div className="max-w-3xl mx-auto px-4 md:px-8 -mt-8 pb-16 space-y-10">
                <NameRegistrationForm />

                <section>
                    <h2 className="text-xl md:text-2xl font-bold text-[#0B3979] text-center mb-5">{t('stepsHeading')}</h2>
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

                <section>
                    <h2 className="text-xl md:text-2xl font-bold text-[#0B3979] text-center mb-5">{t('faqHeading')}</h2>
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

                <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center">
                    <h2 className="font-bold text-slate-800">{t('fullProfileTitle')}</h2>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">{t('fullProfileBody')}</p>
                    <Link href="/lawyer-signup" className="inline-block mt-4 rounded-full border border-[#0B3979] text-[#0B3979] font-semibold text-sm px-6 py-2.5 hover:bg-blue-50 transition-colors">
                        {t('fullProfileButton')}
                    </Link>
                </section>
            </div>
        </div>
    );
}
