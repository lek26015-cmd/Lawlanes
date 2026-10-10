/**
 * ทดสอบ webhook แพลนผู้ให้บริการ (processPlanEvent) ด้วย Stripe/Firestore ปลอมในหน่วยความจำ
 * ไม่เรียก Stripe จริง ไม่แตะ Firestore จริง
 * รัน: npx tsx scripts/tests/provider-plan-webhook.test.ts
 */
import assert from 'node:assert/strict';

process.env.STRIPE_PRICE_LAWYER_PRO = 'price_lp';
process.env.STRIPE_PRICE_LAWYER_TOP = 'price_lt';
process.env.STRIPE_PRICE_INTERPRETER_PRO = 'price_ip';
process.env.STRIPE_PRICE_INTERPRETER_TOP = 'price_it';

// ---------- Firestore ปลอม (เฉพาะที่โค้ดใช้) ----------
function getPath(obj: any, path: string) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function fakeDb() {
    const store = new Map<string, any>();
    const snap = (path: string) => {
        const data = store.get(path);
        return { exists: data !== undefined, id: path.split('/').pop(), data: () => data, get: (f: string) => getPath(data, f) };
    };
    const ref = (path: string): any => ({ path, get: async () => snap(path) });
    const db: any = {
        store,
        collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`) }),
        runTransaction: async (fn: (tx: any) => Promise<any>) => {
            const writes: (() => void)[] = [];
            let wrote = false;
            const tx = {
                get: async (r: any) => {
                    assert.equal(wrote, false, 'Firestore: reads must come before writes');
                    return snap(r.path);
                },
                create: (r: any, d: any) => { wrote = true; writes.push(() => { if (store.has(r.path)) throw new Error('exists'); store.set(r.path, d); }); },
                set: (r: any, d: any) => { wrote = true; writes.push(() => store.set(r.path, d)); },
                update: (r: any, d: any) => { wrote = true; writes.push(() => store.set(r.path, { ...store.get(r.path), ...d })); },
            };
            const out = await fn(tx);
            writes.forEach(w => w()); // commit ทีเดียวตอนจบ (ล้มกลางทาง = ไม่มีอะไรถูกเขียน)
            return out;
        },
    };
    return db;
}

// ---------- Stripe ปลอม ----------
function sub(id: string, o: { status?: string; price?: string; customer?: string; product?: string; profileId?: string; created?: number } = {}): any {
    return {
        id,
        status: o.status ?? 'active',
        created: o.created ?? 1,
        cancel_at_period_end: false,
        customer: o.customer ?? 'cus_1',
        metadata: o.product === undefined ? { product: 'lawyer_plan', profileId: o.profileId ?? 'L1' } : (o.product ? { product: o.product, profileId: o.profileId ?? 'L1' } : { userId: 'u1' }),
        items: { data: [{ price: { id: o.price ?? 'price_lp' }, current_period_end: 4102444800 }] }, // ปี 2100 — เทสต์ไม่หมดอายุเอง
    };
}
function fakeStripe(subs: Record<string, any>, extra: { invoicePayments?: any[] } = {}) {
    const calls: string[] = [];
    const stripe: any = {
        calls,
        subscriptions: {
            retrieve: async (id: string) => {
                calls.push(`retrieve:${id}`);
                if (!subs[id]) throw Object.assign(new Error('No such subscription'), { code: 'resource_missing', statusCode: 404 });
                return subs[id];
            },
            list: async ({ customer }: any) => ({ data: Object.values(subs).filter((s: any) => s.customer === customer) }),
        },
        invoicePayments: { list: async () => ({ data: extra.invoicePayments ?? [] }) },
        charges: { retrieve: async (id: string) => ({ id, customer: 'cus_1' }) },
    };
    return stripe;
}
const ev = (id: string, type: string, object: any): any => ({ id, type, data: { object } });

(async () => {
    const { processPlanEvent } = await import('../../src/lib/provider-plan-webhook');

    const profilePath = 'lawyerProfiles/L1';
    const seed = (db: any, plan?: any) => db.store.set(profilePath, { name: 'x', status: 'approved', ...(plan ? { plan } : {}) });

    // 1) event มาไม่ตามลำดับ: payload บอก active/top แต่ Stripe ล่าสุดคือ canceled → บันทึกตาม retrieve
    {
        const db = fakeDb(); seed(db, { customerId: 'cus_1', subscriptionId: 'sub_1', status: 'active', tier: 'pro' });
        const stripe = fakeStripe({ sub_1: sub('sub_1', { status: 'canceled' }) });
        const stalePayload = sub('sub_1', { status: 'active', price: 'price_lt' });
        const r = await processPlanEvent(stripe, db, ev('evt_1', 'customer.subscription.updated', stalePayload));
        assert.equal(r.status, 'saved');
        const plan = db.store.get(profilePath).plan;
        assert.equal(plan.status, 'canceled', 'state comes from retrieve, not payload');
        assert.equal(plan.tier, 'pro', 'tier from retrieved price, not payload price');
        assert.ok(stripe.calls.includes('retrieve:sub_1'));
        assert.ok(db.store.has('providerPlanStripeEvents/evt_1'), 'marker written with plan');
        assert.equal(db.store.has('stripeEvents/evt_1') || db.store.has('stripe_events/evt_1'), false, 'never touches CapDeal markers');
    }

    // 2) กรอง product: subscription ของ CapDeal → ignored ไม่มีอะไรถูกเขียน
    {
        const db = fakeDb(); seed(db);
        const stripe = fakeStripe({ sub_c: sub('sub_c', { product: '' }) });
        const r = await processPlanEvent(stripe, db, ev('evt_2', 'invoice.paid', { parent: { subscription_details: { subscription: 'sub_c' } } }));
        assert.equal(r.status, 'ignored');
        assert.equal(db.store.has('providerPlanStripeEvents/evt_2'), false, 'no marker for foreign events');
        assert.equal(db.store.get(profilePath).plan, undefined);
        // checkout ของ CapDeal กรองตั้งแต่ metadata ของ session (ไม่ต้องเรียก Stripe)
        const r2 = await processPlanEvent(stripe, db, ev('evt_2b', 'checkout.session.completed', { mode: 'subscription', metadata: { userId: 'u1' }, subscription: 'sub_c' }));
        assert.equal(r2.status, 'ignored');
        assert.equal(stripe.calls.filter((c: string) => c === 'retrieve:sub_c').length, 1);
        // event ที่ไม่ได้รับมือ
        assert.equal((await processPlanEvent(stripe, db, ev('evt_2c', 'customer.created', {}))).status, 'ignored');
    }

    // 3) Price ไม่รู้จัก → tier free + billingAlerts
    {
        const db = fakeDb(); seed(db);
        const stripe = fakeStripe({ sub_u: sub('sub_u', { price: 'price_bogus' }) });
        const r = await processPlanEvent(stripe, db, ev('evt_3', 'customer.subscription.created', { id: 'sub_u' }));
        assert.equal(r.status, 'saved');
        assert.equal((r as any).tier, 'free');
        assert.equal(db.store.get(profilePath).plan.tier, 'free', 'unknown price never grants a tier');
        const alert = db.store.get('billingAlerts/evt_3_unknown_price');
        assert.ok(alert, 'alert written');
        assert.equal(alert.priceId, 'price_bogus');
        assert.equal(alert.profileId, 'L1');
        assert.equal(JSON.stringify(alert).includes('@'), false, 'no email in alert');
    }

    // 4) event ซ้ำ → duplicate ไม่เรียก Stripe อีก
    {
        const db = fakeDb(); seed(db);
        const stripe = fakeStripe({ sub_1: sub('sub_1') });
        assert.equal((await processPlanEvent(stripe, db, ev('evt_4', 'customer.subscription.updated', { id: 'sub_1' }))).status, 'saved');
        const before = stripe.calls.length;
        assert.equal((await processPlanEvent(stripe, db, ev('evt_4', 'customer.subscription.updated', { id: 'sub_1' }))).status, 'duplicate');
        assert.equal(stripe.calls.length, before);
    }

    // 5) subscription เก่าที่จบแล้วไม่เขียนทับตัวปัจจุบัน · ตัวที่สองที่ยัง active → แจ้งแอดมิน
    {
        const db = fakeDb(); seed(db, { customerId: 'cus_1', subscriptionId: 'sub_new', status: 'active', tier: 'top', priceId: 'price_lt' });
        const stripe = fakeStripe({ sub_new: sub('sub_new', { price: 'price_lt' }), sub_old: sub('sub_old', { status: 'canceled' }), sub_dup: sub('sub_dup') });
        const r = await processPlanEvent(stripe, db, ev('evt_5', 'customer.subscription.deleted', { id: 'sub_old' }));
        assert.deepEqual(r, { status: 'skipped', reason: 'stale_subscription' });
        assert.equal(db.store.get(profilePath).plan.subscriptionId, 'sub_new');
        assert.ok(db.store.has('providerPlanStripeEvents/evt_5'), 'skipped events are still claimed');
        const r2 = await processPlanEvent(stripe, db, ev('evt_5b', 'customer.subscription.created', { id: 'sub_dup' }));
        assert.deepEqual(r2, { status: 'skipped', reason: 'duplicate_subscription' });
        assert.ok(db.store.get('billingAlerts/evt_5b_duplicate_subscription'));
        assert.equal(db.store.get(profilePath).plan.tier, 'top');
    }

    // 6) โปรไฟล์ค้าง subscription ที่ Stripe จบไปแล้ว → ตัวใหม่เขียนได้ (ตรวจกับ Stripe ไม่เชื่อสถานะเก่า)
    {
        const db = fakeDb(); seed(db, { customerId: 'cus_1', subscriptionId: 'sub_gone', status: 'active', tier: 'pro' });
        const stripe = fakeStripe({ sub_2: sub('sub_2', { price: 'price_lt' }) });
        const r = await processPlanEvent(stripe, db, ev('evt_6', 'checkout.session.completed', { mode: 'subscription', metadata: { product: 'lawyer_plan', profileId: 'L1' }, subscription: 'sub_2' }));
        assert.equal(r.status, 'saved');
        assert.equal(db.store.get(profilePath).plan.subscriptionId, 'sub_2');
    }

    // 7) charge.refunded → หา subscription ผ่าน invoice payment, แจ้งแอดมิน, sync แพลนใหม่ (ไม่คืนเงิน/ยกเลิกเอง)
    {
        const db = fakeDb(); seed(db, { customerId: 'cus_1', subscriptionId: 'sub_1', status: 'active', tier: 'pro' });
        const stripe = fakeStripe({ sub_1: sub('sub_1') }, { invoicePayments: [{ invoice: { id: 'in_1', parent: { subscription_details: { subscription: 'sub_1' } } } }] });
        const r = await processPlanEvent(stripe, db, ev('evt_7', 'charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', customer: 'cus_1', amount_refunded: 49900, currency: 'thb', billing_details: { email: 'a@b.c' } }));
        assert.equal(r.status, 'saved');
        const alert = db.store.get('billingAlerts/evt_7_charge_refunded');
        assert.equal(alert.amount, 49900);
        assert.equal(alert.subscriptionId, 'sub_1');
        assert.equal(JSON.stringify(alert).includes('a@b.c'), false, 'no PII copied from payload');
        assert.equal(stripe.subscriptions.cancel, undefined, 'never cancels on its own');
    }

    // 8) dispute ของ customer CapDeal (ไม่มี subscription ของเรา) → ignored ไม่แจ้งเตือน
    {
        const db = fakeDb(); seed(db);
        const stripe = fakeStripe({ sub_c: sub('sub_c', { product: '' }) });
        const r = await processPlanEvent(stripe, db, ev('evt_8', 'charge.dispute.created', { id: 'dp_1', charge: 'ch_9', payment_intent: null, amount: 100, currency: 'thb', reason: 'fraudulent' }));
        assert.equal(r.status, 'ignored');
        assert.equal([...db.store.keys()].some(k => k.startsWith('billingAlerts/')), false);
    }

    // 9) past_due → บันทึกเวลาเริ่ม และยังใช้สิทธิ์ได้ระหว่าง 3 วัน
    {
        const { effectiveTier } = await import('../../src/lib/provider-plans');
        const db = fakeDb(); seed(db, { customerId: 'cus_1', subscriptionId: 'sub_1', status: 'active', tier: 'pro' });
        const stripe = fakeStripe({ sub_1: sub('sub_1', { status: 'past_due' }) });
        await processPlanEvent(stripe, db, ev('evt_9', 'invoice.payment_failed', { parent: { subscription_details: { subscription: 'sub_1' } } }));
        const plan = db.store.get(profilePath).plan;
        assert.equal(plan.status, 'past_due');
        assert.ok(plan.pastDueSince);
        assert.equal(effectiveTier(plan), 'pro', 'grace period active');
        assert.equal(effectiveTier(plan, new Date(Date.parse(plan.pastDueSince) + 4 * 24 * 3600 * 1000)), 'free', 'grace over');
    }

    // 10) Stripe ล้ม → throw (route ตอบ 500) และไม่มีตัวจองค้าง → Stripe retry ได้
    {
        const db = fakeDb(); seed(db);
        const stripe = fakeStripe({});
        stripe.subscriptions.retrieve = async () => { throw new Error('network'); };
        await assert.rejects(processPlanEvent(stripe, db, ev('evt_10', 'customer.subscription.updated', { id: 'sub_1' })));
        assert.equal(db.store.has('providerPlanStripeEvents/evt_10'), false);
    }

    console.log('provider-plan-webhook: all tests passed');
})().catch(e => { console.error(e); process.exit(1); });
