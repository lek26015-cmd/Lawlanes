/* eslint-disable @next/next/no-img-element -- รูปมาจากหลายโดเมน (หน้าเดิมของแอดมิน / รูปโปรไฟล์ทนาย) */
import {
    BadgeCheck, Calendar, Clock, Facebook, Globe, Languages, Mail, MapPin, MessageSquare, Navigation, Phone, Star,
} from 'lucide-react';
import type { LandingViewData } from '@/lib/landing-page-server';
import { DEFAULT_SECTION_TITLES, type LandingContact, type LandingFont, type SectionKey } from '@/lib/landing-page';

/**
 * ตัวแสดงผล landing page — ไม่มี hook ใช้ได้ทั้งหน้าสาธารณะ (server) และตัวอย่างสดในหน้าแก้ไข (client)
 * หน้าของแอดมินแบบเดิม (kind: 'legacy') แสดงด้วยแม่แบบ classic
 */

// ฟอนต์หัวข้อ — ประกาศใน [locale]/layout.tsx (self-host ผ่าน next/font) · Prompt คือฟอนต์หลักของเว็บ
const LANDING_FONT_FAMILY: Record<LandingFont, string | undefined> = {
    prompt: undefined,
    serif: "var(--font-landing-serif), 'Noto Serif Thai', serif",
    sarabun: "var(--font-landing-sarabun), 'Sarabun', sans-serif",
};

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const T = {
    th: {
        chat: 'แชทกับทนาย', book: 'นัดปรึกษา', verified: 'ยืนยันตัวตนกับ Lawslane แล้ว', license: 'ใบอนุญาตเลขที่',
        reviewCount: 'รีวิว', visit: 'เปิดดู', education: 'การศึกษา', experience: 'ประสบการณ์', openMap: 'เปิดใน Google Maps',
        closed: 'ปิด', days: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
        disclaimer: 'ข้อมูลในหน้านี้จัดทำโดยทนายความเจ้าของหน้า ไม่ถือเป็นคำแนะนำทางกฎหมายสำหรับกรณีของคุณ',
        poweredBy: 'สร้างหน้าเว็บด้วย Lawslane',
    },
    en: {
        chat: 'Chat with lawyer', book: 'Book a consultation', verified: 'Identity verified with Lawslane', license: 'License no.',
        reviewCount: 'reviews', visit: 'Visit', education: 'Education', experience: 'Experience', openMap: 'Open in Google Maps',
        closed: 'Closed', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        disclaimer: 'Content on this page is provided by the lawyer and is not legal advice for your situation.',
        poweredBy: 'Built with Lawslane',
    },
};
type Dict = typeof T.th;

function contactItems(c: LandingContact, t: Dict) {
    const items: { icon: React.ElementType; label: string; value: string; href?: string }[] = [];
    if (c.phone) items.push({ icon: Phone, label: 'Phone', value: c.phone, href: `tel:${c.phone.replace(/[^0-9+]/g, '')}` });
    if (c.email) items.push({ icon: Mail, label: 'Email', value: c.email, href: `mailto:${c.email}` });
    if (c.lineId) items.push({ icon: MessageSquare, label: 'LINE', value: c.lineId });
    if (c.facebook) items.push({ icon: Facebook, label: 'Facebook', value: t.visit, href: c.facebook });
    if (c.website) items.push({ icon: Globe, label: 'Website', value: c.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), href: c.website });
    if (c.address) items.push({ icon: MapPin, label: 'Address', value: c.address });
    return items;
}

function ContactGrid({ contact, t, color }: { contact: LandingContact; t: Dict; color: string }) {
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
    const tpl = page.template;
    const color = page.themeColor;
    const fontFamily = LANDING_FONT_FAMILY[page.headingFont];
    const fontStyle = fontFamily ? { fontFamily } : undefined;
    const s = page.sections;
    const photo = page.profileImage || lawyer.imageUrl;
    const profileHref = `/${locale}/lawyers/${lawyer.id}`;
    const pick = (th?: string, en?: string) => (locale === 'en' && en ? en : th || '');
    const description = pick(lawyer.description, lawyer.descriptionEn);
    const education = pick(lawyer.education, lawyer.educationEn);
    const experience = pick(lawyer.experience, lawyer.experienceEn);
    const aboutText = s.about.text || description;
    const hasRating = typeof lawyer.averageRating === 'number' && (lawyer.reviewCount || 0) > 0;
    const address = s.location.mapQuery || page.contactInfo.address || '';
    const titleOf = (k: SectionKey) => page.sectionTitles[k] || DEFAULT_SECTION_TITLES[k];
    const dark = tpl === 'modern' || tpl === 'elegant';

    const card = tpl === 'minimal' ? 'p-5 rounded-lg border border-slate-200 bg-white' : 'p-5 rounded-xl bg-white border border-slate-100 shadow-sm';

    const ctaButtons = (onDark: boolean, center: boolean) => (
        <div className={`flex flex-wrap gap-3 ${center ? 'justify-center' : ''}`}>
            <a href={profileHref} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium shadow-sm hover:opacity-90"
                style={onDark ? { backgroundColor: '#fff', color } : { backgroundColor: color, color: '#fff' }}>
                <MessageSquare className="w-4 h-4" /> {t.chat}
            </a>
            <a href={`${profileHref}/schedule`} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium border ${onDark ? 'border-white/60 text-white hover:bg-white/10' : 'bg-white hover:bg-slate-50'}`}
                style={onDark ? undefined : { borderColor: color, color }}>
                <Calendar className="w-4 h-4" /> {t.book}
            </a>
        </div>
    );

    const badges = (onDark: boolean, center: boolean) => (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${center ? 'justify-center' : ''} ${onDark ? 'text-white/85' : 'text-slate-500'}`}>
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

    const logo = page.logo ? <img src={page.logo} alt="" className="h-10 md:h-12 w-auto max-w-[180px] object-contain" /> : null;

    const cover = (
        <>
            {page.heroImage && <img src={page.heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            {page.heroImage && <div className="absolute inset-0 bg-black" style={{ opacity: page.heroOverlay / 100 }} />}
        </>
    );

    // ---------- ส่วนหัวตามแม่แบบ ----------
    let header: React.ReactNode;
    if (tpl === 'modern') {
        header = (
            <header className="relative overflow-hidden text-white" style={{ backgroundColor: color }}>
                {cover}
                <div className="relative container mx-auto px-4 max-w-5xl py-14 md:py-20 flex flex-col-reverse md:flex-row items-center gap-8">
                    <div className="flex-1 space-y-4 text-center md:text-left">
                        {logo && <div className="flex justify-center md:justify-start">{logo}</div>}
                        <h1 className={`text-3xl md:text-5xl font-bold leading-tight`} style={fontStyle}>{page.title}</h1>
                        {page.tagline && <p className="text-lg text-white/85">{page.tagline}</p>}
                        <div className="md:[&>div]:justify-start">{badges(true, true)}</div>
                        <div className="pt-2 md:[&>div]:justify-start">{ctaButtons(true, true)}</div>
                    </div>
                    {avatar('w-36 h-36 md:w-52 md:h-52')}
                </div>
            </header>
        );
    } else if (tpl === 'minimal') {
        header = (
            <header className="bg-white border-b border-slate-200">
                <div className="container mx-auto px-4 max-w-4xl py-12 md:py-16 flex flex-col md:flex-row md:items-center gap-6">
                    {avatar('w-24 h-24 md:w-28 md:h-28 !border-0 !shadow-none')}
                    <div className="flex-1 space-y-3">
                        {logo}
                        <div className="w-10 h-1 rounded-full" style={{ backgroundColor: color }} />
                        <h1 className={`text-3xl md:text-4xl font-semibold text-slate-900`} style={fontStyle}>{page.title}</h1>
                        {page.tagline && <p className="text-lg text-slate-600">{page.tagline}</p>}
                        {badges(false, false)}
                        <div className="pt-1">{ctaButtons(false, false)}</div>
                    </div>
                </div>
                {page.heroImage && (
                    <div className="container mx-auto px-4 max-w-4xl pb-10">
                        <div className="relative h-48 md:h-72 rounded-xl overflow-hidden">{cover}</div>
                    </div>
                )}
            </header>
        );
    } else if (tpl === 'elegant') {
        header = (
            <header className="relative overflow-hidden bg-slate-900 text-white">
                {cover}
                <div className="relative container mx-auto px-4 max-w-3xl py-16 md:py-24 text-center space-y-5">
                    {logo && <div className="flex justify-center">{logo}</div>}
                    <div className="flex justify-center">{avatar('w-28 h-28 md:w-36 md:h-36')}</div>
                    <div className="flex items-center justify-center gap-3 text-white/60">
                        <span className="h-px w-10 bg-current" />
                        <span className="w-2 h-2 rotate-45 bg-current" />
                        <span className="h-px w-10 bg-current" />
                    </div>
                    <h1 className={`text-3xl md:text-5xl font-medium tracking-wide`} style={fontStyle}>{page.title}</h1>
                    {page.tagline && <p className="text-lg text-white/80">{page.tagline}</p>}
                    {badges(true, true)}
                    <div className="pt-2">{ctaButtons(true, true)}</div>
                </div>
                <div className="relative h-1.5" style={{ backgroundColor: color }} />
            </header>
        );
    } else {
        header = (
            <header>
                <div className="h-[28vh] md:h-[38vh] relative w-full overflow-hidden" style={{ backgroundColor: color }}>
                    {cover}
                    {logo && <div className="absolute top-4 left-4 bg-white/90 rounded-lg px-3 py-2">{logo}</div>}
                </div>
                <div className="container mx-auto px-4 max-w-3xl -mt-16 md:-mt-24 relative text-center space-y-4">
                    <div className="flex justify-center">{avatar('w-32 h-32 md:w-44 md:h-44')}</div>
                    <h1 className={`text-3xl md:text-4xl font-semibold tracking-wide`} style={{ ...fontStyle, color }}>{page.title}</h1>
                    {page.tagline && <p className="text-lg text-slate-600">{page.tagline}</p>}
                    {badges(false, true)}
                    <div className="pt-2">{ctaButtons(false, true)}</div>
                </div>
            </header>
        );
    }

    // ---------- เนื้อหาแต่ละส่วน (คืน null = ไม่แสดง) ----------
    const body = (k: SectionKey): React.ReactNode => {
        switch (k) {
            case 'about':
                return s.about.enabled && aboutText ? <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{aboutText}</p> : null;
            case 'experience':
                if (!s.experience.enabled || (!education && !experience)) return null;
                return (
                    <div className="grid gap-4 md:grid-cols-2">
                        {experience && <div className={card}><h3 className="font-semibold text-slate-800 mb-2">{t.experience}</h3><p className="text-sm text-slate-600 whitespace-pre-wrap">{experience}</p></div>}
                        {education && <div className={card}><h3 className="font-semibold text-slate-800 mb-2">{t.education}</h3><p className="text-sm text-slate-600 whitespace-pre-wrap">{education}</p></div>}
                    </div>
                );
            case 'specialties':
                if (!s.specialties.enabled || !lawyer.specialty.length) return null;
                return (
                    <div className="flex flex-wrap gap-2">
                        {lawyer.specialty.map(sp => <span key={sp} className="px-3 py-1.5 rounded-full text-sm border" style={{ borderColor: color, color }}>{sp}</span>)}
                    </div>
                );
            case 'services':
                if (!s.services.enabled || !s.services.items.length) return null;
                return (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {s.services.items.map((it, i) => (
                            <div key={i} className={card}>
                                <div className="w-8 h-1 rounded-full mb-3" style={{ backgroundColor: color }} />
                                <h3 className="font-semibold text-slate-800 mb-1">{it.title}</h3>
                                {it.description && <p className="text-sm text-slate-600 whitespace-pre-wrap">{it.description}</p>}
                            </div>
                        ))}
                    </div>
                );
            case 'team':
                if (!s.team.enabled || !s.team.items.length) return null;
                return (
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                        {s.team.items.map((m, i) => (
                            <div key={i} className={`${card} text-center`}>
                                <div className="w-20 h-20 mx-auto mb-3 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                                    {m.photo ? <img src={m.photo} alt={m.name} className="w-full h-full object-cover" /> : <span className="text-2xl font-semibold text-slate-400">{m.name.charAt(0)}</span>}
                                </div>
                                <div className="font-medium text-slate-800">{m.name}</div>
                                {m.role && <div className="text-xs text-slate-500 mt-0.5">{m.role}</div>}
                            </div>
                        ))}
                    </div>
                );
            case 'gallery':
                if (!s.gallery.enabled || !s.gallery.images.length) return null;
                return (
                    <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                        {s.gallery.images.map((src, i) => (
                            <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100"><img src={src} alt="" className="w-full h-full object-cover" /></div>
                        ))}
                    </div>
                );
            case 'reviews':
                if (!s.reviews.enabled || !hasRating) return null;
                return (
                    <a href={profileHref} className={`inline-flex items-center gap-3 ${card} hover:shadow-md`}>
                        <Star className="w-8 h-8 fill-amber-400 text-amber-400" />
                        <div>
                            <div className="text-2xl font-bold text-slate-800">{lawyer.averageRating!.toFixed(1)} / 5</div>
                            <div className="text-sm text-slate-500">{lawyer.reviewCount} {t.reviewCount}</div>
                        </div>
                    </a>
                );
            case 'faq':
                if (!s.faq.enabled || !s.faq.items.length) return null;
                return (
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
                );
            case 'hours': {
                const sch = lawyer.schedule;
                if (!s.hours.enabled || !sch?.workingHours) return null;
                return (
                    <div className={`${card} max-w-md`}>
                        <ul className="divide-y divide-slate-100 text-sm">
                            {DAY_KEYS.map((d, i) => (
                                <li key={d} className="flex justify-between py-2">
                                    <span className="text-slate-600">{t.days[i]}</span>
                                    <span className={sch.availableDays?.[d] ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                                        {sch.availableDays?.[d] ? `${sch.workingHours.start} – ${sch.workingHours.end}` : t.closed}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-3 text-xs text-slate-400 inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {t.book} →{' '}
                            <a href={`${profileHref}/schedule`} className="underline" style={{ color }}>{t.visit}</a>
                        </p>
                    </div>
                );
            }
            case 'languages':
                if (!s.languages.enabled || !s.languages.items.length) return null;
                return (
                    <div className="flex flex-wrap gap-2">
                        {s.languages.items.map(l => (
                            <span key={l} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-white border border-slate-200 text-slate-700">
                                <Languages className="w-3.5 h-3.5" style={{ color }} /> {l}
                            </span>
                        ))}
                    </div>
                );
            case 'location':
                // ไม่ฝังแผนที่ (iframe ส่ง IP ผู้เข้าชมให้ Google + CSP ไม่อนุญาต) — ให้กดเปิดเองแทน
                if (!s.location.enabled || !address) return null;
                return (
                    <div className={`${card} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                        <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 mt-0.5 shrink-0" style={{ color }} />
                            <p className="text-slate-700 whitespace-pre-wrap">{address}</p>
                        </div>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer nofollow"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white shrink-0" style={{ backgroundColor: color }}>
                            <Navigation className="w-4 h-4" /> {t.openMap}
                        </a>
                    </div>
                );
            case 'custom':
                if (!s.custom.enabled || !s.custom.items.length) return null;
                return (
                    <div className="space-y-6">
                        {s.custom.items.map((b, i) => (
                            <div key={i}>
                                <h3 className={`font-semibold text-slate-800 mb-2`} style={fontStyle}>{b.title}</h3>
                                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{b.body}</p>
                            </div>
                        ))}
                    </div>
                );
            case 'contact':
                return (
                    <div className="space-y-6">
                        <ContactGrid contact={page.contactInfo} t={t} color={color} />
                        {ctaButtons(false, tpl === 'classic' || tpl === 'elegant')}
                    </div>
                );
        }
    };

    const rendered = page.sectionOrder
        .map(k => ({ k, node: body(k) }))
        .filter((x): x is { k: SectionKey; node: NonNullable<React.ReactNode> } => x.node != null);

    const center = tpl === 'elegant';

    return (
        <div className={`min-h-screen text-slate-900 ${tpl === 'minimal' ? 'bg-white' : tpl === 'classic' ? 'bg-[#FDFBF7]' : tpl === 'elegant' ? 'bg-stone-50' : 'bg-slate-50'}`}>
            {header}

            <main className={`container mx-auto px-4 max-w-4xl ${dark ? 'py-4' : 'pt-6'}`}>
                {rendered.map(({ k, node }, i) => (
                    <section key={k} className={`py-10 md:py-14 ${i > 0 ? 'border-t border-slate-200/70' : ''}`}>
                        <h2 className={`text-xl md:text-2xl font-semibold text-slate-800 mb-6 ${center ? 'text-center' : ''}`} style={fontStyle}>
                            {tpl === 'minimal' && <span className="inline-block w-1.5 h-5 rounded-full mr-2 align-[-2px]" style={{ backgroundColor: color }} />}
                            {titleOf(k)}
                        </h2>
                        {node}
                    </section>
                ))}
            </main>

            <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 space-y-2 px-4">
                <p>{t.disclaimer}</p>
                <p><a href={`/${locale}`} className="hover:text-slate-600">{t.poweredBy}</a></p>
            </footer>
        </div>
    );
}
