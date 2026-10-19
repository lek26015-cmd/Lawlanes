import { getTranslations } from 'next-intl/server';
import { Sparkles, SlidersHorizontal, MessageSquare, ShieldCheck, Languages } from 'lucide-react';
import { Link } from '@/navigation';
import { SITE_URL } from '@/lib/seo';

const FAQ_COUNT = 5;

/**
 * เนื้อหาเรนเดอร์ฝั่ง server ใต้รายชื่อทนาย — ตอบคำค้น "หาทนาย / ปรึกษาทนาย / ค่าทนาย / lawyer thailand"
 * ใน Search Console · ไม่ระบุราคาหรือเคลมว่าปรึกษาทนายฟรี (ฟรีเฉพาะผู้ช่วย AI ลลิน)
 */
export async function LawyersGuide({ locale }: { locale: string }) {
    const t = await getTranslations({ locale, namespace: 'Lawyers.guide' });
    const steps = [
        { icon: Sparkles, title: t('step1Title'), body: t('step1Body') },
        { icon: SlidersHorizontal, title: t('step2Title'), body: t('step2Body') },
        { icon: MessageSquare, title: t('step3Title'), body: t('step3Body') },
    ];
    const faqs = Array.from({ length: FAQ_COUNT }, (_, i) => ({ q: t(`faq${i + 1}Q`), a: t(`faq${i + 1}A`) }));
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        url: `${SITE_URL}/${locale}/lawyers`,
        mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    };

    return (
        <div className="max-w-6xl mx-auto px-4 md:px-6 pb-16 space-y-12">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

            <section>
                <h2 className="text-2xl md:text-3xl font-bold text-[#0B3979] text-center mb-6">{t('heading')}</h2>
                <ol className="grid gap-4 md:grid-cols-3">
                    {steps.map((s, i) => (
                        <li key={s.title} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="w-8 h-8 rounded-full bg-[#0B3979] text-white text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                <s.icon className="w-5 h-5 text-[#0B3979]" />
                                <h3 className="font-semibold text-slate-800">{s.title}</h3>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
                        </li>
                    ))}
                </ol>
                <div className="flex flex-wrap justify-center gap-3 mt-6">
                    <Link href="/verify-lawyer" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 h-10 text-sm font-medium text-[#0B3979] hover:bg-slate-50">
                        <ShieldCheck className="w-4 h-4" /> {t('verifyLink')}
                    </Link>
                    <Link href="/interpreters" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 h-10 text-sm font-medium text-[#0B3979] hover:bg-slate-50">
                        <Languages className="w-4 h-4" /> {t('interpreterLink')}
                    </Link>
                </div>
            </section>

            <section className="max-w-4xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold text-[#0B3979] text-center mb-6">{t('faqHeading')}</h2>
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
    );
}
