/**
 * ทดสอบ logic แพลนผู้ให้บริการ (ไม่เรียก Stripe / Firestore)
 * รัน: npx tsx scripts/tests/provider-plans.test.ts
 */
import assert from 'node:assert/strict';

process.env.STRIPE_PRICE_LAWYER_PRO = 'price_lp';
process.env.STRIPE_PRICE_LAWYER_TOP = 'price_lt';
process.env.STRIPE_PRICE_INTERPRETER_PRO = 'price_ip';
process.env.STRIPE_PRICE_INTERPRETER_TOP = 'price_it';
process.env.STRIPE_PRICE_LAWYER_PRO_PREVIOUS = 'price_lp_old1, price_lp_old2';

(async () => {
    const { effectiveTier, sortByTier, lawyerDisplayTier } = await import('../../src/lib/provider-plans');
    const { tierForPrice, paidTierForPrice } = await import('../../src/lib/stripe-plans');
    const { planTarget, planFromSubscription, unknownPriceId, mergePlan } = await import('../../src/lib/provider-plan-sync');

    const now = new Date('2026-09-26T00:00:00Z');
    const future = '2026-10-26T00:00:00Z';

    // effectiveTier
    assert.equal(effectiveTier(undefined, now), 'free');
    assert.equal(effectiveTier({ tier: 'pro', status: 'active', currentPeriodEnd: future }, now), 'pro');
    assert.equal(effectiveTier({ tier: 'top', status: 'trialing', currentPeriodEnd: future }, now), 'top');
    assert.equal(effectiveTier({ tier: 'pro', status: 'past_due', currentPeriodEnd: future }, now), 'free');
    assert.equal(effectiveTier({ tier: 'pro', status: 'canceled', currentPeriodEnd: future }, now), 'free');
    assert.equal(effectiveTier({ tier: 'pro', status: 'active', currentPeriodEnd: '2026-09-25T00:00:00Z' }, now), 'pro', 'grace 2 days');
    assert.equal(effectiveTier({ tier: 'pro', status: 'active', currentPeriodEnd: '2026-09-20T00:00:00Z' }, now), 'free', 'expired');
    assert.equal(effectiveTier({ tier: 'gold', status: 'active' }, now), 'free', 'unknown tier');

    // sortByTier stable
    const sorted = sortByTier([{ id: 'a' }, { id: 'b', planTier: 'pro' as const }, { id: 'c', planTier: 'top' as const }, { id: 'd', planTier: 'pro' as const }]);
    assert.deepEqual(sorted.map(x => x.id), ['c', 'b', 'd', 'a']);

    // legacy name
    assert.equal(lawyerDisplayTier({ name: 'นายกฤตเมธ ไวโส' }), 'top');
    assert.equal(lawyerDisplayTier({ name: 'x', planTier: 'pro' }), 'pro');
    assert.equal(lawyerDisplayTier({ name: 'x' }), 'free');

    // tierForPrice — แยกทนาย/ล่าม
    assert.equal(tierForPrice('lawyer', 'price_lt'), 'top');
    assert.equal(tierForPrice('lawyer', 'price_ip'), 'free', 'interpreter price on lawyer = free');
    assert.equal(tierForPrice('interpreter', 'price_ip'), 'pro');
    assert.equal(tierForPrice('lawyer', null), 'free');

    // planTarget — ข้าม event ของ CapDeal
    assert.deepEqual(planTarget({ product: 'lawyer_plan', profileId: 'L1' }), { kind: 'lawyer', profileId: 'L1' });
    assert.deepEqual(planTarget({ product: 'interpreter_plan', profileId: 'I1' }), { kind: 'interpreter', profileId: 'I1' });
    assert.equal(planTarget({ userId: 'u1', planId: 'pro' }), null, 'capdeal metadata ignored');
    assert.equal(planTarget({ product: 'lawyer_plan', profileId: 'a/b' }), null, 'path injection');
    assert.equal(planTarget(null), null);

    // planFromSubscription — API ใหม่ (period บน item) และเก่า
    const subNew: any = { id: 'sub_1', status: 'active', cancel_at_period_end: false, customer: 'cus_1',
        items: { data: [{ price: { id: 'price_lt' }, current_period_end: 1790000000 }] } };
    const p1 = planFromSubscription('lawyer', subNew);
    assert.equal(p1.tier, 'top'); assert.equal(p1.customerId, 'cus_1'); assert.equal(p1.subscriptionId, 'sub_1');
    assert.equal(p1.currentPeriodEnd, new Date(1790000000 * 1000).toISOString());
    const subOld: any = { id: 'sub_2', status: 'past_due', cancel_at_period_end: true, customer: { id: 'cus_2' }, current_period_end: 1790000000,
        items: { data: [{ price: { id: 'price_ip' } }] } };
    const p2 = planFromSubscription('interpreter', subOld);
    assert.equal(p2.tier, 'pro'); assert.equal(p2.status, 'past_due'); assert.equal(p2.customerId, 'cus_2'); assert.equal(p2.cancelAtPeriodEnd, true);
    assert.equal(effectiveTier(p2, now), 'free', 'past_due not effective');

    // past_due — ใช้ต่อได้ 3 วันนับจาก pastDueSince · ไม่รู้ว่าเริ่มเมื่อไหร่ = free
    const day = 24 * 60 * 60 * 1000;
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
    assert.equal(effectiveTier({ tier: 'pro', status: 'past_due', currentPeriodEnd: future, pastDueSince: ago(1 * day) }, now), 'pro', 'past_due day 1');
    assert.equal(effectiveTier({ tier: 'top', status: 'past_due', currentPeriodEnd: future, pastDueSince: ago(3 * day - 60000) }, now), 'top', 'past_due just under 3 days');
    assert.equal(effectiveTier({ tier: 'pro', status: 'past_due', currentPeriodEnd: future, pastDueSince: ago(3 * day + 60000) }, now), 'free', 'past_due over 3 days');
    assert.equal(effectiveTier({ tier: 'pro', status: 'past_due', currentPeriodEnd: future, pastDueSince: null }, now), 'free', 'past_due without start');
    assert.equal(effectiveTier({ tier: 'pro', status: 'unpaid', currentPeriodEnd: future, pastDueSince: ago(day) }, now), 'free', 'unpaid never');

    // Price ไม่รู้จัก → ไม่ให้แพลน · Price เก่าที่ระบุไว้ยังรู้จัก
    assert.equal(paidTierForPrice('lawyer', 'price_lp_old2'), 'pro', 'previous price recognised');
    assert.equal(paidTierForPrice('lawyer', 'price_unknown'), null);
    assert.equal(paidTierForPrice('interpreter', 'price_lp_old1'), null, 'previous price is per kind');
    const subUnknown: any = { id: 'sub_3', status: 'active', cancel_at_period_end: false, customer: 'cus_3',
        items: { data: [{ price: { id: 'price_hacked' }, current_period_end: 1790000000 }] } };
    const p3 = planFromSubscription('lawyer', subUnknown);
    assert.equal(p3.tier, 'free', 'unknown price → free');
    assert.equal(effectiveTier(p3, now), 'free');
    assert.equal(unknownPriceId('lawyer', p3), 'price_hacked');
    assert.equal(unknownPriceId('lawyer', p1), null);
    assert.equal(unknownPriceId('lawyer', { priceId: null }), null);

    // mergePlan — กันตัวเก่าเขียนทับ + customer ไม่ตรง + past_due start
    const live: any = { tier: 'pro', status: 'active', customerId: 'cus_1', subscriptionId: 'sub_new', currentPeriodEnd: future };
    const oldCanceled: any = { tier: 'pro', status: 'canceled', customerId: 'cus_1', subscriptionId: 'sub_old', currentPeriodEnd: null };
    assert.deepEqual(mergePlan(live, oldCanceled, now), { ok: false, reason: 'stale_subscription' });
    assert.deepEqual(mergePlan(live, { ...oldCanceled, status: 'active' }, now), { ok: false, reason: 'duplicate_subscription' });
    assert.deepEqual(mergePlan(live, { ...live, customerId: 'cus_x' }, now), { ok: false, reason: 'customer_mismatch' });
    assert.equal(mergePlan(live, oldCanceled, now, false).ok, true, 'stored sub verified ended → newer event may write');
    assert.equal(mergePlan({ ...live, status: 'canceled' }, { ...oldCanceled, subscriptionId: 'sub_2nd', status: 'active' }, now).ok, true, 'new sub after old canceled');
    assert.equal(mergePlan({ customerId: 'cus_1', subscriptionId: null, status: 'none' } as any, live, now).ok, true, 'first subscription');
    const pd = mergePlan(live, { ...live, status: 'past_due' }, now);
    assert.ok(pd.ok && pd.plan.pastDueSince === now.toISOString(), 'past_due start recorded');
    const later = new Date(now.getTime() + day);
    const pd2 = mergePlan(pd.ok ? pd.plan : null, { ...live, status: 'past_due' }, later);
    assert.ok(pd2.ok && pd2.plan.pastDueSince === now.toISOString(), 'past_due start kept');
    const back = mergePlan(pd2.ok ? pd2.plan : null, live, later);
    assert.ok(back.ok && back.plan.pastDueSince === null, 'past_due cleared when paid');

    console.log('provider-plans: all tests passed');
})().catch(e => { console.error(e); process.exit(1); });
