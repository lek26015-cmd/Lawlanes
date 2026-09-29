/**
 * Landing page ของทนาย (`lawslane.com/p/{slug}`) — สิทธิ์ของแพลน Pro/บริษัท
 *
 * ใช้ collection `landingPages` เดิมร่วมกับหน้าที่แอดมินสร้าง (lawslane-admin/landing-pages)
 * หน้าของทนายมี `ownerType: 'lawyer'` + `lawyerId` และ doc id = `lawyer_{lawyerProfileId}` (ทนาย 1 คน 1 หน้า)
 * เขียนผ่าน server action (Admin SDK) เท่านั้น — rules ให้แอดมินเขียนได้คนเดียวเหมือนเดิม
 *
 * ข้อมูลที่ต้องเชื่อถือได้ (ชื่อ เลขใบอนุญาต สถานะยืนยัน รีวิว ความเชี่ยวชาญ) ไม่เก็บในหน้านี้
 * แต่ดึงสดจาก lawyerProfiles ทุกครั้งที่แสดง ทนายแก้เองไม่ได้
 *
 * ไฟล์นี้ import ได้ทั้ง client และ server
 */

export const LANDING_TEMPLATES = ['classic', 'modern'] as const;
export type LandingTemplate = (typeof LANDING_TEMPLATES)[number];

/** สีธีมให้เลือกจากชุดนี้เท่านั้น (ไม่รับค่าสีอิสระ — คุมให้อ่านง่ายทุกแม่แบบ) */
export const LANDING_THEME_COLORS = ['#002f4b', '#1e3a8a', '#0f766e', '#7c2d12', '#6b21a8', '#334155'] as const;

export const LANDING_LIMITS = {
    slugMin: 3,
    slugMax: 40,
    title: 80,
    tagline: 160,
    about: 3000,
    services: 6,
    serviceTitle: 80,
    serviceDescription: 400,
    faq: 8,
    faqQuestion: 160,
    faqAnswer: 800,
    contactField: 200,
    imageBytes: 5 * 1024 * 1024,
} as const;

export type LandingService = { title: string; description: string };
export type LandingFaq = { question: string; answer: string };

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
    themeColor: string;
    heroImage: string;
    sections: {
        about: { enabled: boolean; text: string };
        specialties: { enabled: boolean };
        services: { enabled: boolean; items: LandingService[] };
        reviews: { enabled: boolean };
        faq: { enabled: boolean; items: LandingFaq[] };
    };
    contactInfo: LandingContact;
    status: 'published' | 'draft';
};

export const EMPTY_LANDING: LawyerLandingInput = {
    slug: '',
    title: '',
    tagline: '',
    template: 'classic',
    themeColor: LANDING_THEME_COLORS[0],
    heroImage: '',
    sections: {
        about: { enabled: true, text: '' },
        specialties: { enabled: true },
        services: { enabled: false, items: [] },
        reviews: { enabled: true },
        faq: { enabled: false, items: [] },
    },
    contactInfo: {},
    status: 'draft',
};

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

export type SanitizeResult = { ok: true; value: LawyerLandingInput } | { ok: false; error: string };

/** ตรวจ + ตัดค่าที่ client ส่งมาให้อยู่ในกรอบ — ใช้ฝั่ง server ก่อนบันทึก และฝั่ง client เพื่อเตือนล่วงหน้า */
export function sanitizeLandingInput(raw: any): SanitizeResult {
    const L = LANDING_LIMITS;
    const slug = normalizeSlug(raw?.slug);
    const sErr = slugError(slug);
    if (sErr) return { ok: false, error: sErr };

    const title = str(raw?.title, L.title);
    if (!title) return { ok: false, error: 'กรุณาใส่ชื่อที่จะแสดงบนหน้า' };

    const s = raw?.sections || {};
    const services = (Array.isArray(s.services?.items) ? s.services.items : [])
        .slice(0, L.services)
        .map((i: any) => ({ title: str(i?.title, L.serviceTitle), description: str(i?.description, L.serviceDescription) }))
        .filter((i: LandingService) => i.title);
    const faq = (Array.isArray(s.faq?.items) ? s.faq.items : [])
        .slice(0, L.faq)
        .map((i: any) => ({ question: str(i?.question, L.faqQuestion), answer: str(i?.answer, L.faqAnswer) }))
        .filter((i: LandingFaq) => i.question && i.answer);

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

    const heroImage = str(raw?.heroImage, 500);
    if (heroImage && !isAllowedImageUrl(heroImage)) return { ok: false, error: 'รูปปกต้องอัปโหลดผ่านหน้านี้' };

    const value: LawyerLandingInput = {
        slug,
        title,
        tagline: str(raw?.tagline, L.tagline),
        template: LANDING_TEMPLATES.includes(raw?.template) ? raw.template : 'classic',
        themeColor: (LANDING_THEME_COLORS as readonly string[]).includes(raw?.themeColor) ? raw.themeColor : LANDING_THEME_COLORS[0],
        heroImage,
        sections: {
            about: { enabled: s.about?.enabled !== false, text: str(s.about?.text, L.about) },
            specialties: { enabled: s.specialties?.enabled !== false },
            services: { enabled: s.services?.enabled === true, items: services },
            reviews: { enabled: s.reviews?.enabled !== false },
            faq: { enabled: s.faq?.enabled === true, items: faq },
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

    const texts = [
        value.title,
        value.tagline,
        value.sections.about.text,
        ...value.sections.services.items.flatMap(i => [i.title, i.description]),
        ...value.sections.faq.items.flatMap(i => [i.question, i.answer]),
    ];
    for (const t of texts) {
        const hit = findProhibitedClaim(t);
        if (hit) {
            return { ok: false, error: `ข้อความ "${hit}" เข้าข่ายรับประกันผลหรืออวดอ้างเกินจริง ซึ่งขัดมรรยาททนายความ กรุณาแก้ก่อนบันทึก` };
        }
    }

    return { ok: true, value };
}
