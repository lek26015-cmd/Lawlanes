import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, ShieldCheck, Search, UserCheck } from 'lucide-react';
import { Link } from '@/navigation';
import { pageMetadata } from '@/lib/seo';
import { NameRegistrationForm } from './name-registration-form';

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

    const steps = [
        { icon: UserCheck, title: t('step1Title'), body: t('step1Body') },
        { icon: ShieldCheck, title: t('step2Title'), body: t('step2Body') },
        { icon: Search, title: t('step3Title'), body: t('step3Body') },
    ];

    return (
        <div className="min-h-screen bg-[#F4F6F9]">
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
