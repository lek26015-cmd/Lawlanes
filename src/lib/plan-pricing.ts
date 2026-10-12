import 'server-only';

import { initAdmin } from '@/lib/firebase-admin';
import type { ProviderKind } from '@/lib/provider-plans';
import { createPlanPricingReader, ENV_ONLY_PRICING, type PlanPricingProduct, type PlanPricingRead } from '@/lib/plan-pricing-core';

/**
 * ตัวอ่านราคากลางจาก Firestore (PLAN-08 เฟส 2) — server เท่านั้น, แคช 60 วินาที
 * โครงข้อมูล/การตรวจรูป/แคช อยู่ที่ plan-pricing-core.ts · อ่านไม่ได้ = log แล้วใช้ env (ไม่ทำให้หน้าแพลนล่ม)
 */
const reader = createPlanPricingReader(async (collection, product) => {
    const app = await initAdmin();
    if (!app) throw new Error('firebase admin not ready');
    const snap = await app.firestore().collection(collection).doc(product).get();
    return snap.exists ? snap.data() : undefined;
});

export function getPlanPricing(product: PlanPricingProduct): Promise<PlanPricingRead> {
    return reader.get(product);
}

/** ราคากลางของแพลนผู้ให้บริการแต่ละแบบ — ล่ามยังใช้ env อย่างเดียว */
export function pricingForKind(kind: ProviderKind): Promise<PlanPricingRead> {
    return kind === 'lawyer' ? reader.get('lawyer') : Promise.resolve(ENV_ONLY_PRICING);
}
