'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Check, Crown, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from '@/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PLAN_INFO, type PaidTier, type PlanTier, type ProviderKind } from '@/lib/provider-plans';
import {
    getMyPlanAction,
    openPlanPortalAction,
    startPlanCheckoutAction,
    syncPlanFromCheckoutAction,
} from '@/app/actions/provider-plan-actions';

type PlanData = Extract<Awaited<ReturnType<typeof getMyPlanAction>>, { success: true }>;

const TIERS: PlanTier[] = ['free', 'pro', 'top'];

/** หน้าเลือก/จัดการแพลนรายเดือน — ใช้ทั้งแดชบอร์ดทนายและแดชบอร์ดล่าม */
export function ProviderPlanPanel({ kind }: { kind: ProviderKind }) {
    const locale = useLocale();
    const L = (th: string, en: string) => (locale === 'th' ? th : en);
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const [data, setData] = useState<PlanData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const handledReturn = useRef(false);

    const load = useCallback(async () => {
        const res = await getMyPlanAction(kind);
        if (res.success) { setData(res); setError(null); } else setError(res.error);
    }, [kind]);

    useEffect(() => {
        // กลับมาจากหน้าชำระเงิน — บันทึกแพลนทันทีไม่ต้องรอ webhook
        const status = searchParams.get('checkout');
        const sessionId = searchParams.get('session_id');
        if (!handledReturn.current && status) {
            handledReturn.current = true;
            if (status === 'success' && sessionId) {
                syncPlanFromCheckoutAction(kind, sessionId).then(res => {
                    toast(res.success
                        ? { title: L('สมัครแพลนสำเร็จ', 'Plan activated') }
                        : { variant: 'destructive', title: L('ยังยืนยันการชำระเงินไม่ได้', 'Payment not confirmed yet'), description: L('ระบบจะอัปเดตให้อัตโนมัติภายในไม่กี่นาที', 'It will update automatically within a few minutes') });
                    load();
                });
                return;
            }
            if (status === 'cancel') toast({ title: L('ยกเลิกการสมัครแพลน', 'Checkout cancelled') });
        }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind]);

    const subscribe = async (tier: PaidTier) => {
        setBusy(tier);
        const res = await startPlanCheckoutAction(kind, tier, locale, acceptedTerms);
        if (res.success) { window.location.href = res.url; return; }
        setBusy(null);
        toast({ variant: 'destructive', title: res.error });
    };

    const manage = async () => {
        setBusy('portal');
        const res = await openPlanPortalAction(kind, locale);
        if (res.success) { window.location.href = res.url; return; }
        setBusy(null);
        toast({ variant: 'destructive', title: res.error });
    };

    if (error) {
        // บัญชีที่ไม่มีโปรไฟล์ทนาย/ล่าม (หรือโหลดไม่สำเร็จ) — เดิมโชว์แค่ข้อความ error ดิบ ไม่เห็นแพลนเลย
        // ตอนนี้แสดงสิทธิ์ของแต่ละแพลนให้ดูได้ แต่ไม่มีราคา/ปุ่มสมัคร (สมัครได้เฉพาะเจ้าของโปรไฟล์)
        const forbidden = error.startsWith('Forbidden');
        return (
            <div className="space-y-6">
                <p className={`text-sm rounded-xl border p-4 ${forbidden ? 'bg-slate-50 text-slate-700' : 'bg-red-50 border-red-200 text-destructive'}`}>
                    {forbidden
                        ? (kind === 'lawyer'
                            ? L('บัญชีนี้ยังไม่มีโปรไฟล์ทนาย — สมัครแพลนได้หลังลงทะเบียนเป็นทนาย', 'This account has no lawyer profile — register as a lawyer to subscribe')
                            : L('บัญชีนี้ยังไม่ใช่ล่ามที่ได้รับการอนุมัติ — สมัครแพลนได้หลังได้รับอนุมัติ', 'This account is not an approved interpreter yet'))
                        : L('โหลดข้อมูลแพลนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'Could not load your plan. Please try again.')}
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                    {TIERS.map(tier => (
                        <Card key={tier} className={`rounded-2xl shadow-sm ${tier === 'top' ? 'border-2 border-amber-300 bg-gradient-to-b from-amber-50/60 to-white' : 'border-none'}`}>
                            <CardContent className="p-5 space-y-4">
                                <p className="font-bold text-lg flex items-center gap-2">
                                    {tier !== 'free' && <Crown className="w-4 h-4 text-amber-500" />}
                                    {L(...PLAN_INFO[kind][tier].name)}
                                </p>
                                <ul className="space-y-2 text-sm">
                                    {PLAN_INFO[kind][tier].perks.map(p => (
                                        <li key={p[0]} className="flex gap-2"><Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />{L(...p)}</li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }
    if (!data) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>;

    const info = PLAN_INFO[kind];
    const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(locale === 'th' ? 'th-TH' : locale, { dateStyle: 'medium' });
    const money = (n: number) => `฿${n.toLocaleString(locale === 'th' ? 'th-TH' : locale, { maximumFractionDigits: 2 })}`;

    return (
        <div className="space-y-6">
            <Card className="rounded-2xl border-none shadow-sm">
                <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">{L('แพลนปัจจุบัน', 'Current plan')}</p>
                        <p className="text-xl font-bold flex items-center gap-2">
                            {data.tier !== 'free' && <Crown className="w-5 h-5 text-amber-500" />}
                            {L(...info[data.tier].name)}
                        </p>
                        {data.tier !== 'free' && data.currentPeriodEnd && (
                            <p className="text-sm text-muted-foreground mt-1">
                                {data.cancelAtPeriodEnd
                                    ? L(`ใช้ได้ถึง ${dateFmt(data.currentPeriodEnd)} แล้วจะกลับเป็นแพลนฟรี`, `Active until ${dateFmt(data.currentPeriodEnd)}, then returns to Free`)
                                    : L(`ต่ออายุอัตโนมัติ ${dateFmt(data.currentPeriodEnd)}`, `Renews on ${dateFmt(data.currentPeriodEnd)}`)}
                            </p>
                        )}
                        {data.status === 'past_due' && (
                            <p className="text-sm text-destructive mt-1">{L('ตัดบัตรไม่สำเร็จ กรุณาอัปเดตวิธีชำระเงิน', 'Payment failed — please update your payment method')}</p>
                        )}
                    </div>
                    {data.hasBillingAccount && (
                        <Button variant="outline" onClick={manage} disabled={!!busy}>
                            {busy === 'portal' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {L('จัดการการชำระเงิน', 'Manage billing')}
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* ยอมรับข้อกำหนดก่อนสมัคร — แพลนต่ออายุอัตโนมัติ (รายการตรวจเอกสารกฎหมาย ข้อ 8) */}
            {data.tier === 'free' && (
                <label className="flex items-start gap-3 rounded-xl border bg-white p-4 text-sm cursor-pointer">
                    <Checkbox checked={acceptedTerms} onCheckedChange={v => setAcceptedTerms(v === true)} className="mt-0.5" />
                    <span>
                        {L('ฉันได้อ่านและยอมรับ', 'I have read and accept the ')}
                        <Link href="/terms#plans" target="_blank" className="underline text-[#0B3979]">{L('ข้อกำหนดการใช้งาน (หมวดแพลนรายเดือน)', 'Terms of Service (monthly plans)')}</Link>
                        {L(' — แพลนต่ออายุและตัดเงินอัตโนมัติทุกรอบจนกว่าจะยกเลิก', ' — plans renew and are charged automatically each period until cancelled.')}
                    </span>
                </label>
            )}

            <div className="grid md:grid-cols-3 gap-4">
                {TIERS.map(tier => {
                    const isCurrent = data.tier === tier;
                    const price = tier === 'free' ? null : data.prices[tier];
                    return (
                        <Card key={tier} className={`rounded-2xl shadow-sm ${tier === 'top' ? 'border-2 border-amber-300 bg-gradient-to-b from-amber-50/60 to-white' : isCurrent ? 'border-2 border-[#0B3979]' : 'border-none'}`}>
                            <CardContent className="p-5 flex flex-col h-full gap-4">
                                <div>
                                    <p className="font-bold text-lg flex items-center gap-2">
                                        {tier !== 'free' && <Crown className="w-4 h-4 text-amber-500" />}
                                        {L(...info[tier].name)}
                                    </p>
                                    <p className="text-2xl font-bold mt-1">
                                        {tier === 'free'
                                            ? money(0)
                                            : price
                                                ? <>{money(price.amount)}<span className="text-sm font-normal text-muted-foreground"> / {price.interval === 'year' ? L('ปี', 'year') : L('เดือน', 'month')}</span></>
                                                : <span className="text-base font-medium text-muted-foreground">{L('เร็ว ๆ นี้', 'Coming soon')}</span>}
                                    </p>
                                </div>
                                <ul className="space-y-2 text-sm flex-1">
                                    {info[tier].perks.map(p => (
                                        <li key={p[0]} className="flex gap-2"><Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />{L(...p)}</li>
                                    ))}
                                </ul>
                                {isCurrent ? (
                                    <Button disabled variant="secondary">{L('แพลนปัจจุบัน', 'Current plan')}</Button>
                                ) : tier === 'free' ? null : data.tier !== 'free' ? (
                                    <Button variant="outline" onClick={manage} disabled={!!busy}>{L('เปลี่ยนแพลน', 'Change plan')}</Button>
                                ) : (
                                    <Button onClick={() => subscribe(tier)} disabled={!price || !!busy || !acceptedTerms} className="bg-[#0B3979] hover:bg-[#0B3979]/90">
                                        {busy === tier && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        {L('สมัครแพลนนี้', 'Subscribe')}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            <p className="text-xs text-muted-foreground">
                {L('ชำระด้วยบัตรผ่าน Stripe ตัดเงินอัตโนมัติทุกรอบ ยกเลิกได้ทุกเมื่อจาก "จัดการการชำระเงิน" แพลนจะใช้ได้จนจบรอบบิล',
                    'Card payments via Stripe, billed automatically each period. Cancel anytime from "Manage billing" — your plan stays active until the end of the billing period.')}
            </p>
        </div>
    );
}
