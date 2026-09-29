/**
 * Landing page ของทนาย (`lawslane.com/p/{slug}`) — สิทธิ์ของแพลน Pro/บริษัท
 *
 * ใช้ collection `landingPages` เดิมร่วมกับหน้าที่แอดมินสร้าง (lawslane-admin/landing-pages)
 * หน้าของทนายมี `ownerType: 'lawyer'` + `lawyerId` และ doc id = `lawyer_{lawyerProfileId}` (ทนาย 1 คน 1 หน้า)
 * เขียนผ่าน server action (Admin SDK) เท่านั้น — rules ให้แอดมินเขียนได้คนเดียวเหมือนเดิม
 *
 * ข้อมูลที่ต้องเชื่อถือได้ (ชื่อ เลขใบอนุญาต สถานะยืนยัน รีวิว ความเชี่ยวชาญ ประวัติ ตารางเวลา) ไม่เก็บในหน้านี้
 * แต่ดึงสดจาก lawyerProfiles ทุกครั้งที่แสดง ทนายแก้ในหน้านี้ไม่ได้
 *
 * ปรับแต่งได้ภายในกรอบที่กำหนด: แม่แบบ ฟอนต์ สี รูป ลำดับ/ชื่อหัวข้อของแต่ละส่วน — ไม่ใช่ลากวางอิสระ
 *
 * ไฟล์นี้ import ได้ทั้ง client และ server
 */

export const LANDING_TEMPLATES = ['classic', 'modern', 'minimal', 'elegant'] as const;
export type LandingTemplate = (typeof LANDING_TEMPLATES)[number];

/** ฟอนต์หัวข้อ — โหลดแบบ self-host ผ่าน next/font (ดู landing-page-view.tsx) */
export const LANDING_FONTS = ['prompt', 'serif', 'sarabun'] as const;
export type LandingFont = (typeof LANDING_FONTS)[number];

/** สีแนะนำ — เลือกสีอื่นเองได้ แต่ต้องผ่านเกณฑ์ความอ่านง่ายกับตัวอักษรสีขาว (ดู colorError) */
export const LANDING_THEME_COLORS = ['#002f4b', '#1e3a8a', '#0f766e', '#7c2d12', '#6b21a8', '#334155', '#9f1239', '#3f6212'] as const;

export const SECTION_KEYS = [
    'about', 'experience', 'specialties', 'services', 'team', 'gallery',
    'reviews', 'faq', 'hours', 'languages', 'location', 'custom', 'contact',
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const DEFAULT_SECTION_TITLES: Record<SectionKey, string> = {
    about: 'เกี่ยวกับ',
    experience: 'ประสบการณ์และการศึกษา',
    specialties: 'ความเชี่ยวชาญ',
    services: 'บริการ',
    team: 'ทีมงาน',
    gallery: 'สำนักงาน',
    reviews: 'รีวิวจากลูกความ',
    faq: 'คำถามที่พบบ่อย',
    hours: 'เวลาทำการ',
    languages: 'ภาษาที่ให้บริการ',
    location: 'ที่ตั้งสำนักงาน',
    custom: 'ข้อมูลเพิ่มเติม',
    contact: 'ติดต่อ',
};

export const LANGUAGE_OPTIONS = ['ไทย', 'English', '中文', '日本語', '한국어', 'Français', 'Deutsch', 'Русский', 'العربية', 'Tiếng Việt', 'မြန်မာ', 'ລາວ', 'ខ្មែរ'] as const;

export const LANDING_LIMITS = {
    slugMin: 3,
    slugMax: 40,
    title: 80,
    tagline: 160,
    sectionTitle: 60,
    about: 3000,
    services: 6,
    serviceTitle: 80,
    serviceDescription: 400,
    faq: 8,
    faqQuestion: 160,
    faqAnswer: 800,
    team: 8,
    teamName: 80,
    teamRole: 80,
    gallery: 6,
    custom: 3,
    customTitle: 80,
    customBody: 2000,
    mapQuery: 200,
    contactField: 200,
    imageBytes: 5 * 1024 * 1024,
} as const;

export type LandingService = { title: string; description: string };
export type LandingFaq = { question: string; answer: string };
export type LandingTeamMember = { name: string; role: string; photo: string };
export type LandingCustomBlock = { title: string; body: string };

export type LandingContact = {
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    lineId?: string;
    facebook?: string;
};

/** เนื้อหาที่ทนายแก้ได้ */
export type LawyerLandingInput = {
    slug: string;
    title: string;
    tagline: string;
    template: LandingTemplate;
    headingFont: LandingFont;
    themeColor: string;
    heroImage: string;
    /** ความเข้มชั้นสีดำทับรูปปก 0-70 (%) */
    heroOverlay: number;
    /** โลโก้สำนักงาน (แสดงที่ส่วนหัว) */
    logo: string;
    /** รูปโปรไฟล์เฉพาะหน้านี้ — ว่าง = ใช้รูปจากบัญชีทนาย */
    profileImage: string;
    sectionOrder: SectionKey[];
    sectionTitles: Partial<Record<SectionKey, string>>;
    sections: {
        about: { enabled: boolean; text: string };
        experience: { enabled: boolean };
        specialties: { enabled: boolean };
        services: { enabled: boolean; items: LandingService[] };
        team: { enabled: boolean; items: LandingTeamMember[] };
        gallery: { enabled: boolean; images: string[] };
        reviews: { enabled: boolean };
        faq: { enabled: boolean; items: LandingFaq[] };
        hours: { enabled: boolean };
        languages: { enabled: boolean; items: string[] };
        location: { enabled: boolean; mapQuery: string };
        custom: { enabled: boolean; items: LandingCustomBlock[] };
        /** ส่วนติดต่อเปิดเสมอ — มีปุ่มแชท/นัดผ่าน Lawslane */
        contact: { enabled: true };
    };
    contactInfo: LandingContact;
    status: 'published' | 'draft';
};

export const EMPTY_LANDING: LawyerLandingInput = {
    slug: '',
    title: '',
    tagline: '',
    template: 'classic',
    headingFont: 'prompt',
    themeColor: LANDING_THEME_COLORS[0],
    heroImage: '',
    heroOverlay: 20,
    logo: '',
    profileImage: '',
    sectionOrder: [...SECTION_KEYS],
    sectionTitles: {},
    sections: {
        about: { enabled: true, text: '' },
        experience: { enabled: true },
        specialties: { enabled: true },
        services: { enabled: false, items: [] },
        team: { enabled: false, items: [] },
        gallery: { enabled: false, images: [] },
        reviews: { enabled: true },
        faq: { enabled: false, items: [] },
        hours: { enabled: false },
        languages: { enabled: false, items: [] },
        location: { enabled: false, mapQuery: '' },
        custom: { enabled: false, items: [] },
        contact: { enabled: true },
    },
    contactInfo: {},
    status: 'draft',
};

/** เติมค่าที่ขาดจากเอกสารเก่า/ข้อมูลไม่ครบ — ใช้ทั้งตอนอ่านจาก Firestore และก่อน sanitize */
export function withLandingDefaults(d: any): LawyerLandingInput {
    const s = d?.sections || {};
    const sections = Object.fromEntries(
        SECTION_KEYS.map(k => [k, { ...(EMPTY_LANDING.sections as any)[k], ...(s[k] || {}) }]),
    ) as LawyerLandingInput['sections'];
    sections.contact = { enabled: true };
    return {
        ...EMPTY_LANDING,
        ...Object.fromEntries(Object.entries(d || {}).filter(([k]) => k in EMPTY_LANDING)),
        sectionOrder: normalizeOrder(d?.sectionOrder),
        sectionTitles: d?.sectionTitles && typeof d.sectionTitles === 'object' ? d.sectionTitles : {},
        sections,
        contactInfo: d?.contactInfo || {},
        status: d?.status === 'published' ? 'published' : 'draft',
    };
}

/** ลำดับส่วน: ตัดค่าที่ไม่รู้จัก/ซ้ำ แล้วต่อท้ายด้วยส่วนที่ขาด (ส่วนใหม่ในอนาคตจะไม่หายจากหน้าเก่า) */
export function normalizeOrder(raw: unknown): SectionKey[] {
    const seen = new Set<SectionKey>();
    for (const k of Array.isArray(raw) ? raw : []) {
        if ((SECTION_KEYS as readonly string[]).includes(k) && !seen.has(k)) seen.add(k);
    }
    for (const k of SECTION_KEYS) if (!seen.has(k)) seen.add(k);
    return [...seen];
}

/** path ที่ชนกับชื่อระบบ/แบรนด์ หรือทำให้คนเข้าใจผิดว่าเป็นหน้าทางการ */
const RESERVED_SLUGS = new Set([
    'admin', 'administrator', 'api', 'app', 'lawslane', 'lawlanes', 'capdeal', 'wittaya',
    'official', 'support', 'help', 'login', 'signup', 'register', 'account', 'dashboard',
    'lawyer', 'lawyers', 'interpreter', 'interpreters', 'about', 'contact', 'privacy', 'terms',
    'payment', 'billing', 'plan', 'plans', 'pricing', 'test', 'null', 'undefined',
    'lawyerscouncil', 'lawyers-council', 'council', 'sapa', 'thailawyerscouncil',
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function normalizeSlug(raw: string): string {
    return String(raw || '').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

/** คืนข้อความผิดพลาด หรือ null ถ้าใช้ได้ */
export function slugError(slug: string): string | null {
    if (slug.length < LANDING_LIMITS.slugMin || slug.length > LANDING_LIMITS.slugMax) {
        return `ชื่อลิงก์ต้องยาว ${LANDING_LIMITS.slugMin}-${LANDING_LIMITS.slugMax} ตัวอักษร`;
    }
    if (!SLUG_RE.test(slug) || slug.includes('--')) {
        return 'ชื่อลิงก์ใช้ได้เฉพาะ a-z, 0-9 และขีด (-) และห้ามขึ้นต้น/ลงท้ายด้วยขีด';
    }
    if (RESERVED_SLUGS.has(slug) || slug.startsWith('lawslane')) {
        return 'ชื่อลิงก์นี้สงวนไว้ กรุณาใช้ชื่ออื่น';
    }
    return null;
}

/** contrast ratio (WCAG) ระหว่างสีกับสีขาว — ปุ่มและแถบสีธีมใช้ตัวอักษรขาว */
export function contrastWithWhite(hex: string): number {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    const lin = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return 1.05 / (L + 0.05);
}

export function colorError(hex: string): string | null {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return 'รูปแบบสีไม่ถูกต้อง (เช่น #002f4b)';
    if (contrastWithWhite(hex) < 4.5) return 'สีนี้อ่อนเกินไป ตัวอักษรสีขาวบนปุ่มจะอ่านยาก กรุณาเลือกสีเข้มขึ้น';
    return null;
}

/**
 * คำที่เข้าข่ายรับประกันผลคดีหรืออวดอ้างเกินจริง — ข้อบังคับมรรยาททนายความจำกัดการโฆษณาชักชวน
 * รายการนี้เป็นด่านแรกเท่านั้น (ยังไม่ผ่านการตรวจจากนักกฎหมาย) ปรับเพิ่ม/ลดได้
 */
const PROHIBITED_CLAIMS: RegExp[] = [
    /รับประกัน(ผล|ชนะ|คดี)/,
    /การันตี/,
    /ชนะ(คดี)?\s*(แน่นอน|แน่ๆ|ชัวร์|100\s*%?|ร้อยเปอร์เซ็นต์)/,
    /ไม่ชนะ(ไม่|คืน)/,
    /(ถูก|เก่ง|ดี)ที่สุด/,
    /อันดับ\s*(1|หนึ่ง)/,
    /เบอร์\s*1/,
    /no\.?\s*1\b/i,
    /guarantee/i,
    /100\s*%\s*(win|success)/i,
    /\bbest\s+lawyer/i,
    /ยืนยันโดยสภาทนาย|รับรองโดยสภาทนาย/,
];

export function findProhibitedClaim(text: string): string | null {
    for (const re of PROHIBITED_CLAIMS) {
        const m = text.match(re);
        if (m) return m[0];
    }
    return null;
}

/** ข้อความทั้งหมดที่ทนายพิมพ์เอง — ใช้ตรวจคำต้องห้ามทั้งฝั่ง client และ server */
export function landingTexts(v: LawyerLandingInput): string[] {
    const s = v.sections;
    return [
        v.title,
        v.tagline,
        ...Object.values(v.sectionTitles).filter((t): t is string => typeof t === 'string'),
        s.about.text,
        ...s.services.items.flatMap(i => [i.title, i.description]),
        ...s.faq.items.flatMap(i => [i.question, i.answer]),
        ...s.team.items.flatMap(i => [i.name, i.role]),
        ...s.custom.items.flatMap(i => [i.title, i.body]),
    ];
}

function str(v: unknown, max: number): string {
    return typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '';
}

function httpsUrl(v: unknown): string {
    const s = str(v, LANDING_LIMITS.contactField);
    if (!s) return '';
    try {
        const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
        return u.toString();
    } catch {
        return '';
    }
}

/** รูปต้องมาจาก CDN ที่เราอัปโหลดให้ (Cloudflare Images) — ไม่รับ URL ภายนอก */
export function isAllowedImageUrl(url: string): boolean {
    try {
        const u = new URL(url);
        return u.protocol === 'https:' && u.hostname === 'imagedelivery.net';
    } catch {
        return false;
    }
}

function image(v: unknown): string {
    const s = str(v, 500);
    return s && isAllowedImageUrl(s) ? s : '';
}

export type SanitizeResult = { ok: true; value: LawyerLandingInput } | { ok: false; error: string };

/** ตรวจ + ตัดค่าที่ client ส่งมาให้อยู่ในกรอบ — ใช้ฝั่ง server ก่อนบันทึก และฝั่ง client เพื่อเตือนล่วงหน้า */
export function sanitizeLandingInput(raw: any): SanitizeResult {
    const L = LANDING_LIMITS;
    const slug = normalizeSlug(raw?.slug);
    const sErr = slugError(slug);
    if (sErr) return { ok: false, error: sErr };

    const title = str(raw?.title, L.title);
    if (!title) return { ok: false, error: 'กรุณาใส่ชื่อที่จะแสดงบนหน้า' };

    const themeColor = String(raw?.themeColor || '').toLowerCase();
    const cErr = colorError(themeColor);
    if (cErr) return { ok: false, error: cErr };

    for (const key of ['heroImage', 'logo', 'profileImage'] as const) {
        const v = str(raw?.[key], 500);
        if (v && !isAllowedImageUrl(v)) return { ok: false, error: 'รูปต้องอัปโหลดผ่านหน้านี้' };
    }

    const s = raw?.sections || {};
    const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);

    const services = list(s.services?.items, L.services)
        .map((i: any) => ({ title: str(i?.title, L.serviceTitle), description: str(i?.description, L.serviceDescription) }))
        .filter((i: LandingService) => i.title);
    const faq = list(s.faq?.items, L.faq)
        .map((i: any) => ({ question: str(i?.question, L.faqQuestion), answer: str(i?.answer, L.faqAnswer) }))
        .filter((i: LandingFaq) => i.question && i.answer);
    const team = list(s.team?.items, L.team)
        .map((i: any) => ({ name: str(i?.name, L.teamName), role: str(i?.role, L.teamRole), photo: image(i?.photo) }))
        .filter((i: LandingTeamMember) => i.name);
    const gallery = list(s.gallery?.images, L.gallery).map(image).filter(Boolean);
    const languages = list(s.languages?.items, LANGUAGE_OPTIONS.length)
        .filter((x: unknown): x is string => (LANGUAGE_OPTIONS as readonly string[]).includes(x as string));
    const custom = list(s.custom?.items, L.custom)
        .map((i: any) => ({ title: str(i?.title, L.customTitle), body: str(i?.body, L.customBody) }))
        .filter((i: LandingCustomBlock) => i.title && i.body);

    const c = raw?.contactInfo || {};
    const email = str(c.email, L.contactField);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'อีเมลไม่ถูกต้อง' };
    const phone = str(c.phone, 30);
    if (phone && !/^[0-9+\-\s()]{6,30}$/.test(phone)) return { ok: false, error: 'เบอร์โทรไม่ถูกต้อง' };
    const website = httpsUrl(c.website);
    const facebook = httpsUrl(c.facebook);
    if (facebook && !/^https:\/\/([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)\//i.test(facebook)) {
        return { ok: false, error: 'ลิงก์ Facebook ต้องเป็นลิงก์ของ facebook.com' };
    }

    const titles: Partial<Record<SectionKey, string>> = {};
    for (const k of SECTION_KEYS) {
        const t = str(raw?.sectionTitles?.[k], L.sectionTitle);
        if (t && t !== DEFAULT_SECTION_TITLES[k]) titles[k] = t;
    }

    const overlay = Number(raw?.heroOverlay);

    const value: LawyerLandingInput = {
        slug,
        title,
        tagline: str(raw?.tagline, L.tagline),
        template: LANDING_TEMPLATES.includes(raw?.template) ? raw.template : 'classic',
        headingFont: LANDING_FONTS.includes(raw?.headingFont) ? raw.headingFont : 'prompt',
        themeColor,
        heroImage: image(raw?.heroImage),
        heroOverlay: Number.isFinite(overlay) ? Math.min(70, Math.max(0, Math.round(overlay / 10) * 10)) : 20,
        logo: image(raw?.logo),
        profileImage: image(raw?.profileImage),
        sectionOrder: normalizeOrder(raw?.sectionOrder),
        sectionTitles: titles,
        sections: {
            about: { enabled: s.about?.enabled !== false, text: str(s.about?.text, L.about) },
            experience: { enabled: s.experience?.enabled !== false },
            specialties: { enabled: s.specialties?.enabled !== false },
            services: { enabled: s.services?.enabled === true, items: services },
            team: { enabled: s.team?.enabled === true, items: team },
            gallery: { enabled: s.gallery?.enabled === true, images: gallery },
            reviews: { enabled: s.reviews?.enabled !== false },
            faq: { enabled: s.faq?.enabled === true, items: faq },
            hours: { enabled: s.hours?.enabled === true },
            languages: { enabled: s.languages?.enabled === true, items: languages },
            location: { enabled: s.location?.enabled === true, mapQuery: str(s.location?.mapQuery, L.mapQuery) },
            custom: { enabled: s.custom?.enabled === true, items: custom },
            contact: { enabled: true },
        },
        contactInfo: Object.fromEntries(
            Object.entries({
                phone,
                email,
                website,
                facebook,
                lineId: str(c.lineId, 50),
                address: str(c.address, L.contactField),
            }).filter(([, v]) => v),
        ),
        status: raw?.status === 'published' ? 'published' : 'draft',
    };

    for (const t of landingTexts(value)) {
        const hit = findProhibitedClaim(t);
        if (hit) {
            return { ok: false, error: `ข้อความ "${hit}" เข้าข่ายรับประกันผลหรืออวดอ้างเกินจริง ซึ่งขัดมรรยาททนายความ กรุณาแก้ก่อนบันทึก` };
        }
    }

    return { ok: true, value };
}
