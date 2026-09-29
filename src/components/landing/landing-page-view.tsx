/* eslint-disable @next/next/no-img-element -- รูปมาจากหลายโดเมน (หน้าเดิมของแอดมิน / รูปโปรไฟล์ทนาย) */
import { BadgeCheck, Calendar, Facebook, Globe, Mail, MapPin, MessageSquare, Phone, Star } from 'lucide-react';
import type { LandingViewData } from '@/lib/landing-page-server';
import type { LandingContact } from '@/lib/landing-page';

/**
 * ตัวแสดงผล landing page — ไม่มี hook ใช้ได้ทั้งหน้าสาธารณะ (server) และตัวอย่างสดในหน้าแก้ไข (client)
 * หน้าของแอดมินแบบเดิม (kind: 'legacy') แสดงด้วยแม่แบบ classic
 */

const T = {
    th: {
        about: 'เกี่ยวกับ', specialties: 'ความเชี่ยวชาญ', services: 'บริการ', reviews: 'รีวิวจากลูกความ',
        faq: 'คำถามที่พบบ่อย', contact: 'ติดต่อ', chat: 'แชทกับทนาย', book: 'นัดปรึกษา',
        verified: 'ยืนยันตัวตนกับ Lawslane แล้ว', license: 'ใบอนุญาตเลขที่', reviewCount: 'รีวิว',
        visit: 'เปิดดู', disclaimer: 'ข้อมูลในหน้านี้จัดทำโดยทนายความเจ้าของหน้า ไม่ถือเป็นคำแนะนำทางกฎหมายสำหรับกรณีของคุณ',
        poweredBy: 'สร้างหน้าเว็บด้วย Lawslane',
    },
    en: {
        about: 'About', specialties: 'Practice areas', services: 'Services', reviews: 'Client reviews',
        faq: 'FAQ', contact: 'Contact', chat: 'Chat with lawyer', book: 'Book a consultation',
        verified: 'Identity verified with Lawslane', license: 'License no.', reviewCount: 'reviews',
        visit: 'Visit', disclaimer: 'Content on this page is provided by the lawyer and is not legal advice for your situation.',
        poweredBy: 'Built with Lawslane',
    },
};

function contactItems(c: LandingContact, t: typeof T.th) {
    const items: { icon: React.ElementType; label: string; value: string; href?: string }[] = [];
    if (c.phone) items.push({ icon: Phone, label: 'Phone', value: c.phone, href: `tel:${c.phone.replace(/[^0-9+]/g, '')}` });
    if (c.email) items.push({ icon: Mail, label: 'Email', value: c.email, href: `mailto:${c.email}` });
    if (c.lineId) items.push({ icon: MessageSquare, label: 'LINE', value: c.lineId });
    if (c.facebook) items.push({ icon: Facebook, label: 'Facebook', value: t.visit, href: c.facebook });
    if (c.website) items.push({ icon: Globe, label: 'Website', value: c.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), href: c.website });
    if (c.address) items.push({ icon: MapPin, label: 'Address', value: c.address });
    return items;
}

function ContactGrid({ contact, t, color }: { contact: LandingContact; t: typeof T.th; color: string }) {
    const items = contactItems(contact, t);
    if (!items.length) return null;
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ icon: Icon, label, value, href }) => {
                const body = (
                    <>
                        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: color }}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 text-left">
                            <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
                            <div className="text-slate-700 break-words">{value}</div>
                        </div>
                    </>
                );
                const cls = 'flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-100 shadow-sm';
                return href ? (
                    <a key={label} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer nofollow" className={`${cls} hover:shadow-md transition-shadow`}>
                        {body}
                    </a>
                ) : (
                    <div key={label} className={cls}>{body}</div>
                );
            })}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="py-10 md:py-14 border-t border-slate-100 first:border-t-0">
            <h2 className="text-xl md:text-2xl font-semibold text-slate-800 mb-6">{title}</h2>
            {children}
        </section>
    );
}

export default function LandingPageView({ data, locale }: { data: LandingViewData; locale: string }) {
    const t = locale === 'th' ? T.th : T.en;

    if (data.kind === 'legacy') {
        const p = data.page;
        return (
            <div className="min-h-screen bg-[#FDFBF7] text-slate-900">
                <div className="h-[35vh] md:h-[45vh] relative w-full overflow-hidden" style={{ backgroundColor: p.themeColor }}>
                    {p.heroImage && <img src={p.heroImage} alt={p.title} className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-black/20" />
                </div>
                <div className="container mx-auto px-4 max-w-3xl -mt-16 md:-mt-24 relative text-center">
                    <div className="w-32 h-32 md:w-48 md:h-48 mx-auto mb-6 rounded-full border-4 border-white shadow-xl overflow-hidden bg-slate-200 flex items-center justify-center">
                        {p.logo ? <img src={p.logo} alt="" className="w-full h-full object-cover" /> : <span className="text-4xl font-bold text-slate-400">{p.title.charAt(0)}</span>}
                    </div>
                    <h1 className="text-3xl md:text-5xl font-light tracking-wide mb-8" style={{ color: p.themeColor }}>{p.title}</h1>
                    <div className="text-lg text-slate-600 whitespace-pre-wrap leading-relaxed pb-12">{p.content}</div>
                </div>
                <div className="bg-white border-t border-slate-100 py-12">
                    <div className="container mx-auto px-4 max-w-5xl">
                        <ContactGrid contact={p.contactInfo} t={t} color={p.themeColor} />
                    </div>
                </div>
            </div>
        );
    }

    const { page, lawyer } = data;
    const color = page.themeColor;
    const s = page.sections;
    const photo = lawyer.imageUrl;
    const profileHref = `/${locale}/lawyers/${lawyer.id}`;
    const description = locale === 'en' && lawyer.descriptionEn ? lawyer.descriptionEn : lawyer.description;
    const aboutText = s.about.text || description;
    const hasRating = typeof lawyer.averageRating === 'number' && (lawyer.reviewCount || 0) > 0;
    const modern = page.template === 'modern';

    const ctas = (
        <div className={`flex flex-wrap gap-3 ${modern ? '' : 'justify-center'}`}>
            <a href={profileHref} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-white shadow-sm hover:opacity-90" style={{ backgroundColor: modern ? '#ffffff' : color, color: modern ? color : '#fff' }}>
                <MessageSquare className="w-4 h-4" /> {t.chat}
            </a>
            <a href={`${profileHref}/schedule`} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium border ${modern ? 'border-white/60 text-white hover:bg-white/10' : 'bg-white hover:bg-slate-50'}`} style={modern ? undefined : { borderColor: color, color }}>
                <Calendar className="w-4 h-4" /> {t.book}
            </a>
        </div>
    );

    const badges = (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${modern ? 'text-white/85' : 'justify-center text-slate-500'}`}>
            <span className="inline-flex items-center gap-1"><BadgeCheck className="w-4 h-4" /> {t.verified}</span>
            {lawyer.licenseNumber && <span>{t.license} {lawyer.licenseNumber}</span>}
            {hasRating && (
                <span className="inline-flex items-center gap-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> {lawyer.averageRating!.toFixed(1)} ({lawyer.reviewCount} {t.reviewCount})
                </span>
            )}
        </div>
    );

    const avatar = (size: string) => (
        <div className={`${size} rounded-full border-4 border-white shadow-xl overflow-hidden bg-slate-200 shrink-0`}>
            {photo ? <img src={photo} alt={page.title} className="w-full h-full object-cover" /> : null}
        </div>
    );

    return (
        <div className={`min-h-screen text-slate-900 ${modern ? 'bg-slate-50' : 'bg-[#FDFBF7]'}`}>
            {modern ? (
                <header className="relative overflow-hidden text-white" style={{ backgroundColor: color }}>
                    {page.heroImage && <img src={page.heroImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />}
                    <div className="relative container mx-auto px-4 max-w-5xl py-14 md:py-20 flex flex-col-reverse md:flex-row items-center md:items-center gap-8">
                        <div className="flex-1 space-y-4 text-center md:text-left">
                            <h1 className="text-3xl md:text-5xl font-bold leading-tight">{page.title}</h1>
                            {page.tagline && <p className="text-lg text-white/85">{page.tagline}</p>}
                            <div className="flex justify-center md:justify-start">{badges}</div>
                            <div className="pt-2 flex justify-center md:justify-start">{ctas}</div>
                        </div>
                        {avatar('w-36 h-36 md:w-52 md:h-52')}
                    </div>
                </header>
            ) : (
                <header>
                    <div className="h-[28vh] md:h-[38vh] relative w-full overflow-hidden" style={{ backgroundColor: color }}>
                        {page.heroImage && <img src={page.heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                        <div className="absolute inset-0 bg-black/15" />
                    </div>
                    <div className="container mx-auto px-4 max-w-3xl -mt-16 md:-mt-24 relative text-center space-y-4">
                        <div className="flex justify-center">{avatar('w-32 h-32 md:w-44 md:h-44')}</div>
                        <h1 className="text-3xl md:text-4xl font-semibold tracking-wide" style={{ color }}>{page.title}</h1>
                        {page.tagline && <p className="text-lg text-slate-600">{page.tagline}</p>}
                        {badges}
                        <div className="pt-2">{ctas}</div>
                    </div>
                </header>
            )}

            <main className={`container mx-auto px-4 max-w-4xl ${modern ? 'py-4' : 'pt-10'}`}>
                {s.about.enabled && aboutText && (
                    <Section title={t.about}>
                        <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{aboutText}</p>
                    </Section>
                )}

                {s.specialties.enabled && lawyer.specialty.length > 0 && (
                    <Section title={t.specialties}>
                        <div className="flex flex-wrap gap-2">
                            {lawyer.specialty.map(sp => (
                                <span key={sp} className="px-3 py-1.5 rounded-full text-sm border" style={{ borderColor: color, color }}>{sp}</span>
                            ))}
                        </div>
                    </Section>
                )}

                {s.services.enabled && s.services.items.length > 0 && (
                    <Section title={t.services}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {s.services.items.map((it, i) => (
                                <div key={i} className="p-5 rounded-xl bg-white border border-slate-100 shadow-sm">
                                    <div className="w-8 h-1 rounded-full mb-3" style={{ backgroundColor: color }} />
                                    <h3 className="font-semibold text-slate-800 mb-1">{it.title}</h3>
                                    {it.description && <p className="text-sm text-slate-600 whitespace-pre-wrap">{it.description}</p>}
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {s.reviews.enabled && hasRating && (
                    <Section title={t.reviews}>
                        <a href={profileHref} className="inline-flex items-center gap-3 p-5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md">
                            <Star className="w-8 h-8 fill-amber-400 text-amber-400" />
                            <div>
                                <div className="text-2xl font-bold text-slate-800">{lawyer.averageRating!.toFixed(1)} / 5</div>
                                <div className="text-sm text-slate-500">{lawyer.reviewCount} {t.reviewCount}</div>
                            </div>
                        </a>
                    </Section>
                )}

                {s.faq.enabled && s.faq.items.length > 0 && (
                    <Section title={t.faq}>
                        <div className="space-y-3">
                            {s.faq.items.map((f, i) => (
                                <details key={i} className="group p-4 rounded-xl bg-white border border-slate-100">
                                    <summary className="font-medium text-slate-800 cursor-pointer list-none flex justify-between gap-4">
                                        {f.question}<span className="text-slate-400 group-open:rotate-45 transition-transform">+</span>
                                    </summary>
                                    <p className="mt-3 text-slate-600 whitespace-pre-wrap">{f.answer}</p>
                                </details>
                            ))}
                        </div>
                    </Section>
                )}

                <Section title={t.contact}>
                    <div className="space-y-6">
                        <ContactGrid contact={page.contactInfo} t={t} color={color} />
                        <div className={modern ? '' : 'flex justify-center'}>
                            {/* ปุ่มในส่วนติดต่อใช้สีธีมเสมอ ไม่ขึ้นกับแม่แบบ */}
                            <div className="flex flex-wrap gap-3">
                                <a href={profileHref} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-white" style={{ backgroundColor: color }}>
                                    <MessageSquare className="w-4 h-4" /> {t.chat}
                                </a>
                                <a href={`${profileHref}/schedule`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium border bg-white" style={{ borderColor: color, color }}>
                                    <Calendar className="w-4 h-4" /> {t.book}
                                </a>
                            </div>
                        </div>
                    </div>
                </Section>
            </main>

            <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 space-y-2 px-4">
                <p>{t.disclaimer}</p>
                <p>
                    <a href={`/${locale}`} className="hover:text-slate-600">{t.poweredBy}</a>
                </p>
            </footer>
        </div>
    );
}
