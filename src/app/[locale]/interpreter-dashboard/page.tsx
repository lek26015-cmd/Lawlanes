'use client';

/**
 * แดชบอร์ดล่าม — งาน / รายได้ / โปรไฟล์และราคา / ตารางเวลา / บัญชีรับเงิน
 * สิทธิ์ตรวจใน server action ทุกตัว (requireInterpreter) middleware เป็นแค่ด่าน UX
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Globe2, Loader2, MapPin, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BankSelect } from '@/components/bank-select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
    getInterpreterGpPercentAction,
    getMyInterpreterProfileAction,
    updateInterpreterPayoutDetailsAction,
    updateInterpreterScheduleAction,
    updateMyInterpreterProfileAction,
} from '@/app/actions/interpreter-profile-actions';
import {
    completeInterpreterBookingAction,
    getInterpreterDashboardDataAction,
    respondToInterpreterBookingAction,
    type InterpreterPayoutView,
} from '@/app/actions/interpreter-booking-actions';
import { InterpreterProfileFields, type InterpreterProfileValues } from '@/components/interpreter/interpreter-profile-fields';
import { useInterpreterLabels } from '@/components/interpreter/use-interpreter-labels';
import { ProfilePhotoPicker } from '@/components/interpreter/profile-photo-picker';
import { InterpreterConversationsList } from '@/components/interpreter/interpreter-conversations-list';
import type { InterpreterBookingView, MyInterpreterProfile } from '@/lib/interpreter-types';
import type { LawyerSchedule } from '@/lib/types';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const HOURS = Array.from({ length: 25 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
const DEFAULT_SCHEDULE: LawyerSchedule = {
    workingHours: { start: '09:00', end: '18:00' },
    availableDays: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false },
    overrides: [],
};

type DashboardData = NonNullable<Awaited<ReturnType<typeof getInterpreterDashboardDataAction>>>;

function JobCard({ b, onChanged }: { b: InterpreterBookingView; onChanged: () => void }) {
    const t = useTranslations('InterpreterDashboard');
    const tBook = useTranslations('Interpreters.book');
    const tRoot = useTranslations('Interpreters');
    const l = useInterpreterLabels();
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);
    const [declining, setDeclining] = useState(false);
    const [reason, setReason] = useState('');

    const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
        setBusy(true);
        const res = await fn();
        setBusy(false);
        if (!res.ok) return toast({ variant: 'destructive', title: (res as any).error });
        toast({ title: t('saved') });
        onChanged();
    };

    const canComplete = b.status === 'accepted' && (b.kind === 'translation' || (b.endAt && new Date(b.endAt).getTime() < Date.now()));

    return (
        <Card className="rounded-2xl border shadow-none">
            <CardContent className="p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{b.quote.itemName || l.service(b.serviceType)}</p>
                    <Badge variant={b.status === 'paid' ? 'default' : 'secondary'}>{l.status(b.status)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                    {l.language(b.languagePair.from)} → {l.language(b.languagePair.to)}
                    {' · '}
                    {b.startAt
                        ? `${l.dateTime(b.startAt)} (${b.days ? tBook('daysUnit', { days: b.days }) : tBook('hoursUnit', { hours: b.durationHours ?? 0 })})`
                        : b.pageCount ? tRoot('my.pages', { count: b.pageCount }) : l.service(b.serviceType)}
                </p>
                {b.mode && (
                    <p className="text-sm flex items-start gap-2">
                        {b.mode === 'remote'
                            ? <><Globe2 className="w-4 h-4 mt-0.5" /> {tBook('remoteMode')}</>
                            : <><MapPin className="w-4 h-4 mt-0.5" /> {b.address} ({b.province})</>}
                    </p>
                )}
                {b.notes && <p className="text-sm bg-slate-50 rounded-lg p-3 whitespace-pre-line"><span className="text-muted-foreground">{t('customerNotes')}: </span>{b.notes}</p>}
                {b.contact ? (
                    <p className="text-sm rounded-lg bg-emerald-50 p-3 text-emerald-900">
                        {b.contact.name} · {tRoot('my.contactLine', { phone: b.contact.phone || '—', line: b.contact.lineId || '—' })}
                    </p>
                ) : (
                    <p className="text-xs text-muted-foreground">{t('contactAfterPayment')}</p>
                )}
                <Link href={`/interpreter-chat/${b.conversationId}`} className="text-sm text-[#0B3979] hover:underline">{tRoot('my.openChat')}</Link>
                <div className="grid grid-cols-3 gap-2 text-sm border-t pt-3">
                    <div><p className="text-xs text-muted-foreground">{t('gross')}</p><p>฿{l.satang(b.quote.grossAmount)}</p></div>
                    <div><p className="text-xs text-muted-foreground">{t('gp', { percent: b.quote.gpPercent })}</p><p>-฿{l.satang(b.quote.gpAmount)}</p></div>
                    <div><p className="text-xs text-muted-foreground">{t('net')}</p><p className="font-bold text-emerald-700">฿{l.satang(b.quote.netToInterpreter)}</p></div>
                </div>

                {b.status === 'paid' && !declining && (
                    <div className="flex gap-2">
                        <Button disabled={busy} className="flex-1 bg-[#0B3979]" onClick={() => run(() => respondToInterpreterBookingAction(b.id, true))}>
                            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('accept')}
                        </Button>
                        <Button disabled={busy} variant="outline" onClick={() => setDeclining(true)}>{t('decline')}</Button>
                    </div>
                )}
                {declining && (
                    <div className="space-y-2">
                        <Label>{t('declineReason')}</Label>
                        <Textarea value={reason} maxLength={500} onChange={e => setReason(e.target.value)} />
                        <div className="flex gap-2">
                            <Button disabled={busy} variant="destructive" onClick={() => run(() => respondToInterpreterBookingAction(b.id, false, reason))}>{t('decline')}</Button>
                            <Button variant="ghost" onClick={() => setDeclining(false)}>{tBook('back')}</Button>
                        </div>
                    </div>
                )}
                {b.status === 'accepted' && (
                    <div className="space-y-1">
                        <Button disabled={busy || !canComplete} variant="outline" onClick={() => run(() => completeInterpreterBookingAction(b.id))}>
                            {t('complete')}
                        </Button>
                        <p className="text-xs text-muted-foreground">{t('completeHint')}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function JobsTab({ data, reload }: { data: DashboardData; reload: () => void }) {
    const t = useTranslations('InterpreterDashboard');
    const groups = [
        { title: t('newJobs'), items: data.bookings.filter(b => b.status === 'paid') },
        { title: t('upcoming'), items: data.bookings.filter(b => b.status === 'accepted') },
        { title: t('history'), items: data.bookings.filter(b => !['paid', 'accepted', 'pending_payment'].includes(b.status)) },
    ];
    if (groups.every(g => g.items.length === 0)) return <p className="text-muted-foreground py-8 text-center">{t('noJobs')}</p>;
    return (
        <div className="space-y-8">
            {groups.filter(g => g.items.length).map(g => (
                <div key={g.title} className="space-y-3">
                    <h2 className="font-bold">{g.title}</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        {g.items.map(b => <JobCard key={b.id} b={b} onChanged={reload} />)}
                    </div>
                </div>
            ))}
        </div>
    );
}

function EarningsTab({ data }: { data: DashboardData }) {
    const t = useTranslations('InterpreterDashboard');
    const l = useInterpreterLabels();
    return (
        <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
                <Card className="rounded-2xl border-none shadow-sm"><CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">{t('pendingPayout')}</p>
                    <p className="text-3xl font-bold text-[#0B3979]">฿{l.satang(data.pendingPayoutNet)}</p>
                </CardContent></Card>
                <Card className="rounded-2xl border-none shadow-sm"><CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">{t('paidOut')}</p>
                    <p className="text-3xl font-bold text-emerald-700">฿{l.satang(data.paidOutNet)}</p>
                </CardContent></Card>
            </div>
            <Card className="rounded-2xl border-none shadow-sm">
                <CardHeader><CardTitle className="text-lg">{t('payoutHistory')}</CardTitle></CardHeader>
                <CardContent className="divide-y">
                    {data.payouts.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                    {data.payouts.map((p: InterpreterPayoutView) => (
                        <div key={p.id} className="flex justify-between py-3 text-sm">
                            <span>{p.paidAt ? l.dateTime(p.paidAt) : '—'} · {t('payoutJobs', { count: p.bookingCount })}</span>
                            <span className="font-semibold">฿{l.satang(p.totalNet)}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

function ProfileTab({ profile, gpPercent, onSaved }: { profile: MyInterpreterProfile; gpPercent: number; onSaved: () => void }) {
    const t = useTranslations('InterpreterDashboard');
    const { toast } = useToast();
    const [values, setValues] = useState<InterpreterProfileValues>({
        description: profile.description,
        languages: profile.languages,
        services: profile.services,
        serviceProvinces: profile.serviceProvinces,
        remoteAvailable: profile.remoteAvailable,
        rateCard: profile.rateCard,
    });
    const [imageUrl, setImageUrl] = useState(profile.imageUrl);
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        const res = await updateMyInterpreterProfileAction({ ...values, imageUrl });
        setSaving(false);
        if (!res.ok) return toast({ variant: 'destructive', title: res.error });
        toast({ title: t('saved') });
        onSaved();
    };
    return (
        <Card className="rounded-2xl border-none shadow-sm"><CardContent className="p-6 space-y-6">
            <ProfilePhotoPicker value={imageUrl} onChange={setImageUrl} />
            <InterpreterProfileFields value={values} onChange={setValues} gpPercent={gpPercent} />
            <Button disabled={saving} className="bg-[#0B3979]" onClick={save}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save')}</Button>
        </CardContent></Card>
    );
}

function ScheduleTab({ profile }: { profile: MyInterpreterProfile }) {
    const t = useTranslations('InterpreterDashboard');
    const { toast } = useToast();
    const [s, setS] = useState<LawyerSchedule>(profile.schedule || DEFAULT_SCHEDULE);
    const [newDate, setNewDate] = useState('');
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        const res = await updateInterpreterScheduleAction(s);
        setSaving(false);
        if (!res.ok) return toast({ variant: 'destructive', title: res.error });
        toast({ title: t('saved') });
    };
    return (
        <Card className="rounded-2xl border-none shadow-sm"><CardContent className="p-6 space-y-6">
            <div className="flex flex-wrap gap-4">
                {(['start', 'end'] as const).map(k => (
                    <div key={k} className="space-y-1">
                        <Label>{k === 'start' ? t('workStart') : t('workEnd')}</Label>
                        <Select value={s.workingHours[k]} onValueChange={v => setS({ ...s, workingHours: { ...s.workingHours, [k]: v } })}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                ))}
            </div>
            <div className="space-y-2">
                <Label>{t('days')}</Label>
                <div className="flex flex-wrap gap-4">
                    {DAYS.map(d => (
                        <label key={d} className="flex items-center gap-2 text-sm">
                            <Switch checked={s.availableDays[d]} onCheckedChange={v => setS({ ...s, availableDays: { ...s.availableDays, [d]: v } })} />
                            {t(`daysOfWeek.${d}`)}
                        </label>
                    ))}
                </div>
            </div>
            <div className="space-y-2">
                <Label>{t('overrides')}</Label>
                <div className="flex gap-2">
                    <Input type="date" className="w-48" value={newDate} onChange={e => setNewDate(e.target.value)} />
                    <Button variant="outline" disabled={!newDate} onClick={() => {
                        if (!s.overrides.some(o => o.date === newDate)) setS({ ...s, overrides: [...s.overrides, { date: newDate, reason: '' }] });
                        setNewDate('');
                    }}>{t('addOverride')}</Button>
                </div>
                {s.overrides.map(o => (
                    <p key={o.date} className="flex items-center gap-2 text-sm">
                        {o.date}
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="remove"
                            onClick={() => setS({ ...s, overrides: s.overrides.filter(x => x.date !== o.date) })}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </p>
                ))}
            </div>
            <Button disabled={saving} className="bg-[#0B3979]" onClick={save}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save')}</Button>
        </CardContent></Card>
    );
}

function BankTab({ profile }: { profile: MyInterpreterProfile }) {
    const t = useTranslations('InterpreterDashboard');
    const { toast } = useToast();
    const [bankName, setBankName] = useState(profile.private.bankName || '');
    const [bankAccountNumber, setNumber] = useState(profile.private.bankAccountNumber || '');
    const [bankAccountName, setName] = useState(profile.private.bankAccountName || '');
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        const res = await updateInterpreterPayoutDetailsAction({ bankName, bankAccountNumber, bankAccountName });
        setSaving(false);
        if (!res.ok) return toast({ variant: 'destructive', title: res.error });
        toast({ title: t('saved') });
    };
    return (
        <Card className="rounded-2xl border-none shadow-sm"><CardContent className="p-6 space-y-4 max-w-md">
            <p className="text-sm text-muted-foreground">{t('bankHint')}</p>
            <div className="space-y-1"><Label htmlFor="bn">{t('bankName')}</Label><BankSelect id="bn" value={bankName} onChange={setBankName} placeholder={t('bankNamePlaceholder')} /></div>
            <div className="space-y-1"><Label htmlFor="ba">{t('bankAccountNumber')}</Label><Input id="ba" inputMode="numeric" value={bankAccountNumber} maxLength={20} onChange={e => setNumber(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="bh">{t('bankAccountName')}</Label><Input id="bh" value={bankAccountName} maxLength={100} onChange={e => setName(e.target.value)} /></div>
            <Button disabled={saving} className="bg-[#0B3979]" onClick={save}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save')}</Button>
        </CardContent></Card>
    );
}

export default function InterpreterDashboardPage() {
    const t = useTranslations('InterpreterDashboard');
    const tFor = useTranslations('ForInterpreters');
    const [profile, setProfile] = useState<MyInterpreterProfile | null | undefined>(undefined);
    const [data, setData] = useState<DashboardData | null>(null);
    const [gpPercent, setGpPercent] = useState(0);

    const load = useCallback(async () => {
        const [p, d, gp] = await Promise.all([
            getMyInterpreterProfileAction(),
            getInterpreterDashboardDataAction(),
            getInterpreterGpPercentAction(),
        ]);
        setProfile(p);
        setData(d);
        setGpPercent(gp);
    }, []);

    useEffect(() => { load(); }, [load]);

    if (profile === undefined) {
        return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-[#0B3979]" /></div>;
    }
    if (profile === null) {
        return (
            <div className="container mx-auto px-4 py-24 max-w-md text-center space-y-4">
                <p>{t('notInterpreter')}</p>
                <Button asChild className="bg-[#0B3979]"><Link href="/for-interpreters#apply">{tFor('formTitle')}</Link></Button>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="container mx-auto px-4 md:px-6 py-10 max-w-5xl space-y-6">
                <h1 className="text-2xl md:text-3xl font-bold font-headline">{t('title')}</h1>

                {profile.status !== 'approved' && (
                    <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {profile.status === 'pending' && t('pendingApproval')}
                        {profile.status === 'rejected' && t('rejected', { reason: profile.rejectionReason || '—' })}
                        {profile.status === 'suspended' && t('suspended')}
                    </div>
                )}

                <Tabs defaultValue={profile.status === 'approved' ? 'jobs' : 'profile'}>
                    <TabsList className="flex flex-wrap h-auto">
                        <TabsTrigger value="jobs">{t('tabJobs')}</TabsTrigger>
                        <TabsTrigger value="messages">{t('tabMessages')}</TabsTrigger>
                        <TabsTrigger value="earnings">{t('tabEarnings')}</TabsTrigger>
                        <TabsTrigger value="profile">{t('tabProfile')}</TabsTrigger>
                        <TabsTrigger value="schedule">{t('tabSchedule')}</TabsTrigger>
                        <TabsTrigger value="bank">{t('tabBank')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="jobs" className="pt-4">
                        {data ? <JobsTab data={data} reload={load} /> : <p className="text-muted-foreground">{t('noJobs')}</p>}
                    </TabsContent>
                    <TabsContent value="messages" className="pt-4">
                        <Card className="rounded-2xl border-none shadow-sm"><CardContent className="p-4">
                            <InterpreterConversationsList as="interpreter" />
                        </CardContent></Card>
                    </TabsContent>
                    <TabsContent value="earnings" className="pt-4">
                        {data && <EarningsTab data={data} />}
                    </TabsContent>
                    <TabsContent value="profile" className="pt-4">
                        <ProfileTab profile={profile} gpPercent={gpPercent} onSaved={load} />
                    </TabsContent>
                    <TabsContent value="schedule" className="pt-4">
                        <ScheduleTab profile={profile} />
                    </TabsContent>
                    <TabsContent value="bank" className="pt-4">
                        <BankTab profile={profile} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
