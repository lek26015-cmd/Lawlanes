/**
 * ราคากลางของแพลน (PLAN-08 เฟส 2) — ส่วนที่ไม่แตะ Admin SDK / Stripe (import ได้ในเทสต์)
 * ตัวอ่านจริงที่ต่อ Firestore อยู่ที่ src/lib/plan-pricing.ts (server-only)
 *
 * เอกสาร `{PLAN_PRICING_COLLECTION || 'planPricing'}/{product}` เขียนจากหน้า admin เท่านั้น (Admin SDK · rules ปิดหมด)
 * Stripe test mode ต้องตั้ง PLAN_PRICING_COLLECTION=planPricing_test — Firestore เป็น production ตัวเดียวกัน ห้ามปนกับ live
 *
 * กติกา: ไม่มีเอกสาร / อ่านไม่ได้ / ข้อมูลผิดรูป = ใช้ env เหมือนก่อนมีราคากลาง (เว็บต้องเหมือนเดิมทุกอย่าง)
 */

/** ผลิตภัณฑ์ในราคากลางที่เว็บนี้อ่าน — แพลนล่ามยังใช้ env อย่างเดียว */
export type PlanPricingProduct = 'lawyer';

export type PlanPricingStripe = {
    productId: string | null;
    monthlyPriceId: string | null;
    yearlyPriceId: string | null;
    /** ทุก Price ที่แพลนนี้เคยใช้ — webhook ยังรู้จัก (ผู้สมัครเดิมยังจ่ายราคาเก่า) */
    previousPriceIds: string[];
};

export type PlanPricingPlan = {
    /** บาท (จำนวนเต็ม) · null = ไม่ขาย */
    monthly: number | null;
    yearly: number | null;
    stripe: PlanPricingStripe | null;
    /** ยอดเงินผิดรูป — ห้ามใช้ขาย/แสดงราคา (แพลนนี้ใช้ env) แต่ Price ID ยังให้ webhook รู้จัก */
    malformed?: true;
};

export type PlanPricingDoc = {
    currency: 'thb';
    plans: Record<string, PlanPricingPlan>;
    /** Billing Portal configuration ของผลิตภัณฑ์นี้ · null = ใช้ค่าเริ่มต้นของ Stripe */
    portalConfigId: string | null;
};

/**
 * ผลการอ่าน — `doc: null` แปลว่าใช้ env
 * - ok: มีเอกสารและอ่านได้
 * - missing: ยังไม่มีเอกสาร (หรือผิดรูปทั้งเอกสาร) → env เหมือนเดิม
 * - error: อ่าน Firestore ไม่ได้ → env ไปก่อน แต่ webhook ต้องไม่ลดแพลนเพราะเรื่องนี้ (ดู provider-plan-webhook.ts)
 */
export type PlanPricingRead = { doc: PlanPricingDoc | null; status: 'ok' | 'missing' | 'error' };

export const ENV_ONLY_PRICING: PlanPricingRead = { doc: null, status: 'missing' };

export function planPricingCollection(): string {
    return process.env.PLAN_PRICING_COLLECTION?.trim() || 'planPricing';
}

const isPriceId = (v: unknown): v is string => typeof v === 'string' && /^price_[A-Za-z0-9_]+$/.test(v);
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function parseAmount(v: unknown): number | null | undefined {
    if (v === null) return null;
    return isAmount(v) ? v : undefined; // undefined = ผิดรูป
}

function parseStripe(v: unknown): PlanPricingStripe | null {
    if (!v || typeof v !== 'object') return null;
    const s = v as Record<string, unknown>;
    return {
        productId: typeof s.productId === 'string' && s.productId.startsWith('prod_') ? s.productId : null,
        monthlyPriceId: isPriceId(s.monthlyPriceId) ? s.monthlyPriceId : null,
        yearlyPriceId: isPriceId(s.yearlyPriceId) ? s.yearlyPriceId : null,
        previousPriceIds: Array.isArray(s.previousPriceIds) ? s.previousPriceIds.filter(isPriceId) : [],
    };
}

/**
 * ตรวจรูปเอกสารจาก Firestore — ไม่เชื่อข้อมูลโดยไม่ดู
 * - currency ไม่ใช่ thb / ไม่มี plans → ทั้งเอกสารใช้ไม่ได้ (null → env)
 * - แพลนไหนยอดเงินผิดรูป → ติด malformed (ขาย/แสดงราคาตาม env) แต่ยังเก็บ Price ID ไว้ให้ webhook รู้จัก
 */
export function parsePlanPricingDoc(raw: unknown): PlanPricingDoc | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (r.currency !== 'thb' || !r.plans || typeof r.plans !== 'object') return null;
    const plans: Record<string, PlanPricingPlan> = {};
    for (const [planId, value] of Object.entries(r.plans as Record<string, unknown>)) {
        if (!value || typeof value !== 'object') continue;
        const p = value as Record<string, unknown>;
        const monthly = parseAmount(p.monthly);
        const yearly = p.yearly === undefined ? null : parseAmount(p.yearly);
        if (monthly === undefined || yearly === undefined) {
            console.error('planPricing: malformed amount — plan falls back to env', { planId });
            plans[planId] = { monthly: null, yearly: null, stripe: parseStripe(p.stripe), malformed: true };
            continue;
        }
        plans[planId] = { monthly, yearly, stripe: parseStripe(p.stripe) };
    }
    const portal = typeof r.portalConfigId === 'string' && r.portalConfigId.startsWith('bpc_') ? r.portalConfigId : null;
    return { currency: 'thb', plans, portalConfigId: portal };
}

/** อ่านเอกสารดิบ — ไม่มีเอกสาร = undefined · ล้ม = throw */
export type PlanPricingFetch = (collection: string, product: PlanPricingProduct) => Promise<unknown>;

export const PLAN_PRICING_CACHE_MS = 60 * 1000;
/** อ่านพลาดแล้วจำผล env ไว้สั้น ๆ — ไม่ยิง Firestore ซ้ำทุก request ตอนมีปัญหา */
const ERROR_CACHE_MS = 10 * 1000;

/** ตัวอ่านพร้อมแคช 60 วินาที (ต่อ instance) — แยก factory ไว้ให้เทสต์ใส่ fetch ปลอมได้ */
export function createPlanPricingReader(fetchDoc: PlanPricingFetch, now: () => number = Date.now) {
    const cache = new Map<string, { at: number; ttl: number; value: PlanPricingRead }>();
    return {
        async get(product: PlanPricingProduct): Promise<PlanPricingRead> {
            const collection = planPricingCollection();
            const key = `${collection}/${product}`;
            const hit = cache.get(key);
            if (hit && now() - hit.at < hit.ttl) return hit.value;
            let value: PlanPricingRead;
            let ttl = PLAN_PRICING_CACHE_MS;
            try {
                const raw = await fetchDoc(collection, product);
                const doc = raw === undefined ? null : parsePlanPricingDoc(raw);
                if (raw !== undefined && !doc) console.error('planPricing: malformed document — using env', { key });
                value = { doc, status: doc ? 'ok' : 'missing' };
            } catch (e) {
                // log แค่ข้อความ (ไม่มี PII ในเอกสารนี้อยู่แล้ว)
                console.error('planPricing: read failed — using env', { key, message: (e as Error)?.message });
                value = { doc: null, status: 'error' };
                ttl = ERROR_CACHE_MS;
            }
            cache.set(key, { at: now(), ttl, value });
            return value;
        },
        clear() {
            cache.clear();
        },
    };
}
