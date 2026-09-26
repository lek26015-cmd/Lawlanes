'use client';

/**
 * หน้าจองล่าม — 2 ทาง
 *   ?item=<rateItemId>  เลือกรายการจากเรทการ์ด (หน่วยกำหนดว่าต้องกรอกวันเวลา/จำนวนอะไร)
 *   ?offer=<offerId>    จ่ายตามใบเสนอราคาที่ล่ามส่งในแชท (ราคา/บริการ/วันเวลามาจากใบนั้น)
 * ราคาจริงคิดฝั่ง server ทั้งตอน quote และตอนสร้าง booking
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Copy, FileText, Loader2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { SlipUpload, type SlipState } from '@/components/interpreter/slip-upload';
import { useInterpreterLabels } from '@/components/interpreter/use-interpreter-labels';
import { compressImageToBase64 } from '@/lib/image-utils';
import { saveBase64SlipAction } from '@/app/actions/upload';
import { uploadInterpreterFileAction } from '@/app/actions/interpreter-profile-actions';
import { getInterpreterOfferAction } from '@/app/actions/interpreter-chat-actions';
import {
    createInterpreterBookingAction,
    getInterpreterBusyHoursAction,
    quoteInterpreterBookingAction,
} from '@/app/actions/interpreter-booking-actions';
import { bangkokParts, parseHourString } from '@/lib/interpreter-time';
import {
    BOOKING_LIMITS,
    RATE_LIMITS,
    serviceKind,
    type InterpreterBookingInput,
    type InterpreterBookingStatus,
    type InterpreterLanguageCode,
    type InterpreterOffer,
    type InterpreterQuote,
    type InterpreterService,
    type PublicInterpreter,
} from '@/lib/interpreter-types';

type PaymentAccount = { bankName: string; accountNumber: string; accountName: string } | null;

const DAY_MS = 24 * 60 * 60 * 1000;

async function fileToBase64(file: File): Promise<string> {
    if (file.type.startsWith('image/')) return compressImageToBase64(file);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

export default function BookInterpreterClient({ interpreter, paymentAccount }: {
    interpreter: PublicInterpreter;
    paymentAccount: PaymentAccount;
}) {
    const t = useTranslations('Interpreters.book');
    const tRoot = useTranslations('Interpreters');
    const tNav = useTranslations('Navigation');
    const l = useInterpreterLabels();
    const { toast } = useToast();
    const { user, isUserLoading } = useUser();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const lawyerId = searchParams.get('lawyerId') || undefined;
    const offerId = searchParams.get('offer');

    // ---------- ที่มาของราคา ----------
    const [itemId, setItemId] = useState(() => {
        const q = searchParams.get('item');
        return interpreter.rateCard.find(r => r.id === q)?.id || interpreter.rateCard[0]?.id || '';
    });
    const item = interpreter.rateCard.find(r => r.id === itemId) || null;
    const [offer, setOffer] = useState<InterpreterOffer | null | undefined>(offerId ? undefined : null);

    const itemServices = item?.services.length ? interpreter.services.filter(s => item.services.includes(s)) : interpreter.services;
    const otherLanguages = interpreter.languageCodes.filter(c => c !== 'th');
    const [service, setService] = useState<InterpreterService>(itemServices[0] || interpreter.services[0]);
    const [languageFrom, setLanguageFrom] = useState<InterpreterLanguageCode>(otherLanguages[0] || interpreter.languageCodes[0]);
    const [languageTo, setLanguageTo] = useState<InterpreterLanguageCode>(
        interpreter.languageCodes.includes('th') ? 'th' : interpreter.languageCodes[1]
    );
    const [date, setDate] = useState('');
    const [startHour, setStartHour] = useState<number | null>(null);
    const [quantity, setQuantity] = useState(item?.minQty || 1);
    const [mode, setMode] = useState<'onsite' | 'remote'>(interpreter.serviceProvinces.length ? 'onsite' : 'remote');
    const [province, setProvince] = useState(interpreter.serviceProvinces[0] || '');
    const [address, setAddress] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [documentPaths, setDocumentPaths] = useState<{ path: string; name: string }[]>([]);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [notes, setNotes] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactLineId, setContactLineId] = useState('');

    const [busy, setBusy] = useState<Set<string>>(new Set());
    const [step, setStep] = useState<1 | 2>(1);
    const [quote, setQuote] = useState<InterpreterQuote | null>(null);
    const [loadingQuote, setLoadingQuote] = useState(false);
    const [slip, setSlip] = useState<SlipState>({ file: null, verificationId: null, status: 'none' });
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState<InterpreterBookingStatus | null>(null);

    useEffect(() => {
        if (!user) return;
        setContactName(prev => prev || user.displayName || '');
        getInterpreterBusyHoursAction(interpreter.id).then(list => setBusy(new Set(list)));
        if (offerId) getInterpreterOfferAction(interpreter.id, offerId).then(setOffer);
    }, [user, interpreter.id, offerId]);

    // เปลี่ยนรายการ → ตั้งค่าตั้งต้นใหม่ให้เข้ากับหน่วย
    useEffect(() => {
        if (!item) return;
        setQuantity(item.minQty || 1);
        setStartHour(null);
        if (!itemServices.includes(service)) setService(itemServices[0]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemId]);

    const activeService = offer ? offer.service : service;
    const kind = serviceKind(activeService);
    const unit = offer ? 'offer' : item?.unit;

    /** จำนวนชั่วโมงที่ต้องล็อกต่อวัน สำหรับเลือกเวลาเริ่ม (null = ไม่ต้องเลือกเวลา) */
    const hoursNeeded = unit === 'hour' ? quantity : unit === 'session' ? item!.sessionHours : null;
    const needsDate = unit === 'hour' || unit === 'session' || unit === 'day';
    const offerScheduled = !!offer?.date;
    const needsLocation = kind === 'interpretation' && (needsDate || offerScheduled);

    const { minDate, maxDate } = useMemo(() => {
        const now = Date.now();
        return {
            minDate: bangkokParts(new Date(now + DAY_MS)).dateKey,
            maxDate: bangkokParts(new Date(now + BOOKING_LIMITS.maxDaysAhead * DAY_MS)).dateKey,
        };
    }, []);

    const isClosed = (d: string) => {
        if (!interpreter.schedule) return false;
        const key = bangkokParts(new Date(`${d}T12:00:00+07:00`)).dayKey;
        if ((interpreter.schedule.availableDays as any)?.[key] === false) return true;
        return (interpreter.schedule.overrides || []).some(o => String(o.date).slice(0, 10) === d);
    };
    const workStart = parseHourString(interpreter.schedule?.workingHours?.start) ?? 8;
    const workEnd = parseHourString(interpreter.schedule?.workingHours?.end) ?? 18;

    const hourOptions = useMemo(() => {
        if (!date || hoursNeeded === null || isClosed(date)) return [];
        return range(workStart, workEnd - hoursNeeded).map(h => ({
            hour: h,
            available: range(h, h + hoursNeeded - 1).every(x => !busy.has(`${date}_${String(x).padStart(2, '0')}`)),
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, hoursNeeded, busy, workStart, workEnd]);

    useEffect(() => {
        if (startHour !== null && !hourOptions.find(o => o.hour === startHour && o.available)) setStartHour(null);
    }, [hourOptions, startHour]);

    /** เหมาวัน: วันที่ติดกันต้องเปิดรับงานและว่างทั้งวัน */
    const dayProblem = useMemo(() => {
        if (unit !== 'day' || !date) return false;
        for (let i = 0; i < quantity; i++) {
            const d = bangkokParts(new Date(new Date(`${date}T12:00:00+07:00`).getTime() + i * DAY_MS)).dateKey;
            if (isClosed(d)) return true;
            if (range(workStart, workEnd - 1).some(h => busy.has(`${d}_${String(h).padStart(2, '0')}`))) return true;
        }
        return false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unit, date, quantity, busy, workStart, workEnd]);

    const buildInput = (): InterpreterBookingInput => ({
        interpreterId: interpreter.id,
        ...(offer ? { offerId: offer.id } : { rateItemId: itemId }),
        service: activeService,
        languageFrom: offer ? offer.languageFrom : languageFrom,
        languageTo: offer ? offer.languageTo : languageTo,
        date: needsDate ? date : undefined,
        startHour: hoursNeeded !== null ? startHour ?? undefined : undefined,
        quantity,
        mode: needsLocation ? mode : undefined,
        province: needsLocation && mode === 'onsite' ? province : undefined,
        address: needsLocation && mode === 'onsite' ? address : undefined,
        dueDate: kind === 'translation' ? dueDate || undefined : undefined,
        documentPaths: documentPaths.map(d => d.path),
        notes,
        lawyerId,
        contactName,
        contactPhone,
        contactLineId,
    });

    const contactOk = contactName.trim().length > 0 && /^[0-9+\-\s()]{8,30}$/.test(contactPhone.trim());
    const scheduleOk = !needsDate
        || (unit === 'day' ? !!date && !dayProblem : !!date && startHour !== null);
    const locationOk = !needsLocation || mode === 'remote' || (!!province && address.trim().length >= 5);
    const docsOk = unit !== 'page' || documentPaths.length > 0;
    const canQuote = (offer || item) && contactOk && scheduleOk && locationOk && docsOk;

    const handleQuote = async () => {
        setLoadingQuote(true);
        const res = await quoteInterpreterBookingAction(buildInput());
        setLoadingQuote(false);
        if (!res.ok) return toast({ variant: 'destructive', title: res.error });
        setQuote(res.quote);
        setStep(2);
        setSlip({ file: null, verificationId: null, status: 'none' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDocUpload = async (files: FileList | null) => {
        if (!files?.length) return;
        setUploadingDoc(true);
        try {
            for (const file of Array.from(files).slice(0, 20 - documentPaths.length)) {
                const fd = new FormData();
                fd.append('file', file);
                const res = await uploadInterpreterFileAction(fd, 'booking');
                if (!res.ok) {
                    toast({ variant: 'destructive', title: res.error });
                    continue;
                }
                setDocumentPaths(prev => [...prev, { path: res.path, name: file.name }]);
            }
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleConfirm = async () => {
        if (!slip.file || !quote) return;
        setSubmitting(true);
        try {
            const slipUrl = await saveBase64SlipAction(await fileToBase64(slip.file));
            const res = await createInterpreterBookingAction(buildInput(), { slipUrl, slipVerificationId: slip.verificationId });
            if (!res.ok) return toast({ variant: 'destructive', title: res.error });
            setDone(res.status);
        } catch {
            toast({ variant: 'destructive', title: t('error') });
        } finally {
            setSubmitting(false);
        }
    };

    const copy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: t('copied'), description: text });
    };

    // ---------- สถานะพิเศษ ----------
    // ไม่รอ isUserLoading ถ้ารู้ user แล้ว (ดูเหตุผลใน ForInterpretersClient) — ทุกอย่างในหน้านี้เป็น server action
    if (!user && isUserLoading) {
        return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-[#0B3979]" /></div>;
    }
    if (!user) {
        return (
            <div className="container mx-auto px-4 py-24 max-w-md text-center space-y-4">
                <p className="font-semibold">{t('loginRequired')}</p>
                <Button asChild className="bg-[#0B3979]">
                    <Link href={`/login?redirect=${encodeURIComponent(`${pathname}?${searchParams.toString()}`)}`}>{tNav('login')}</Link>
                </Button>
            </div>
        );
    }
    if (offerId && offer === undefined) {
        return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-[#0B3979]" /></div>;
    }
    if (offerId && (!offer || offer.status !== 'open')) {
        return (
            <div className="container mx-auto px-4 py-24 max-w-md text-center space-y-4">
                <p className="font-semibold">{t('offerUnavailable')}</p>
                <Button asChild variant="outline"><Link href={`/interpreters/${interpreter.id}`}>{interpreter.name}</Link></Button>
            </div>
        );
    }
    if (done) {
        return (
            <div className="container mx-auto px-4 py-24 max-w-md text-center space-y-4">
                <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
                <h1 className="text-2xl font-bold">{t('successTitle')}</h1>
                <p className="text-muted-foreground">{done === 'paid' ? t('successPaid') : t('successPending')}</p>
                <p className="text-sm text-muted-foreground">{t('contactUnlockNote')}</p>
                <Button asChild className="bg-[#0B3979]"><Link href="/dashboard">{t('goDashboard')}</Link></Button>
            </div>
        );
    }

    const unitsLabel = (q: InterpreterQuote) =>
        q.unitType === 'hour' ? t('hoursUnit', { hours: q.units })
        : q.unitType === 'day' ? t('daysUnit', { days: q.units })
        : q.unitType === 'page' ? tRoot('my.pages', { count: q.units })
        : '1';

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="container mx-auto px-4 md:px-6 py-10 max-w-3xl">
                <Link href={`/interpreters/${interpreter.id}${lawyerId ? `?lawyerId=${encodeURIComponent(lawyerId)}` : ''}`} className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> {interpreter.name}
                </Link>
                <h1 className="text-2xl md:text-3xl font-bold font-headline mb-2">{t('title')}</h1>
                <p className="text-sm text-muted-foreground mb-6">
                    {step === 1 ? `1. ${t('step1')}` : `2. ${t('step2')}`}
                </p>

                {step === 1 && (
                    <Card className="rounded-3xl border-none shadow-sm">
                        <CardContent className="p-6 space-y-6">
                            {offer ? (
                                <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 space-y-1">
                                    <p className="text-xs font-semibold text-blue-800">{t('offerFromChat')}</p>
                                    <p className="font-bold">{offer.title}</p>
                                    {offer.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{offer.description}</p>}
                                    <p className="text-sm">
                                        {l.service(offer.service)} · {l.language(offer.languageFrom)} → {l.language(offer.languageTo)}
                                        {offer.date && ` · ${offer.date} ${String(offer.startHour).padStart(2, '0')}:00 (${t('hoursUnit', { hours: offer.hours ?? 0 })})`}
                                    </p>
                                    <p className="text-lg font-bold text-[#0B3979]">฿{l.money(offer.amount)}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label>{t('rateItem')}</Label>
                                        <RadioGroup value={itemId} onValueChange={setItemId} className="space-y-2">
                                            {interpreter.rateCard.map(r => (
                                                <label key={r.id} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${r.id === itemId ? 'border-[#0B3979] bg-blue-50/50' : ''}`}>
                                                    <RadioGroupItem value={r.id} className="mt-1" />
                                                    <span className="flex-1 min-w-0">
                                                        <span className="flex justify-between gap-2">
                                                            <span className="font-medium">{r.name}</span>
                                                            <span className="font-semibold whitespace-nowrap">{l.rate(r.price, r.unit)}</span>
                                                        </span>
                                                        <span className="block text-xs text-muted-foreground">
                                                            {l.unit(r.unit)}{r.description ? ` · ${r.description}` : ''}
                                                        </span>
                                                    </span>
                                                </label>
                                            ))}
                                        </RadioGroup>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>{t('service')}</Label>
                                        <Select value={service} onValueChange={v => setService(v as InterpreterService)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {itemServices.map(s => <SelectItem key={s} value={s}>{l.service(s)}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>{t('languageFrom')}</Label>
                                            <Select value={languageFrom} onValueChange={v => setLanguageFrom(v as InterpreterLanguageCode)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {interpreter.languageCodes.map(c => <SelectItem key={c} value={c}>{l.language(c)}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('languageTo')}</Label>
                                            <Select value={languageTo} onValueChange={v => setLanguageTo(v as InterpreterLanguageCode)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {interpreter.languageCodes.filter(c => c !== languageFrom).map(c => (
                                                        <SelectItem key={c} value={c}>{l.language(c)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {needsDate && (
                                        <div className="grid sm:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="date">{unit === 'day' ? t('startDate') : t('date')}</Label>
                                                <Input id="date" type="date" min={minDate} max={maxDate} value={date} onChange={e => setDate(e.target.value)} />
                                            </div>
                                            {unit === 'hour' && (
                                                <div className="space-y-2">
                                                    <Label>{t('duration')}</Label>
                                                    <Select value={String(quantity)} onValueChange={v => setQuantity(Number(v))}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {range(item!.minQty, BOOKING_LIMITS.maxHours).map(h => (
                                                                <SelectItem key={h} value={String(h)}>{t('hoursUnit', { hours: h })}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                            {unit === 'day' && (
                                                <div className="space-y-2">
                                                    <Label>{t('days')}</Label>
                                                    <Select value={String(quantity)} onValueChange={v => setQuantity(Number(v))}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {range(1, RATE_LIMITS.maxDays).map(d => (
                                                                <SelectItem key={d} value={String(d)}>{t('daysUnit', { days: d })}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                            {hoursNeeded !== null && (
                                                <div className="space-y-2">
                                                    <Label>{t('startTime')}</Label>
                                                    <Select
                                                        value={startHour === null ? undefined : String(startHour)}
                                                        onValueChange={v => setStartHour(Number(v))}
                                                        disabled={!date || hourOptions.length === 0}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={!date ? t('selectDateFirst') : hourOptions.length === 0 ? t('noSlots') : '—'} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {hourOptions.map(o => (
                                                                <SelectItem key={o.hour} value={String(o.hour)} disabled={!o.available}>
                                                                    {String(o.hour).padStart(2, '0')}:00 – {String(o.hour + hoursNeeded).padStart(2, '0')}:00
                                                                    {!o.available ? ` (${t('busy')})` : ''}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {date && hoursNeeded !== null && hourOptions.length === 0 && <p className="text-sm text-amber-700 -mt-3">{t('noSlots')}</p>}
                                    {unit === 'day' && date && dayProblem && <p className="text-sm text-amber-700 -mt-3">{t('daysUnavailable')}</p>}
                                    {unit === 'day' && <p className="text-xs text-muted-foreground -mt-3">{t('dayHint', { start: `${String(workStart).padStart(2, '0')}:00`, end: `${String(workEnd).padStart(2, '0')}:00` })}</p>}
                                    {unit === 'case' && <p className="text-sm rounded-xl bg-slate-50 p-3 text-muted-foreground">{t('caseHint')}</p>}

                                    {unit === 'page' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="pages">{t('pageCount')}</Label>
                                            <Input
                                                id="pages"
                                                type="number"
                                                min={item!.minQty}
                                                max={BOOKING_LIMITS.maxPages}
                                                value={quantity}
                                                onChange={e => setQuantity(Math.max(1, Math.min(BOOKING_LIMITS.maxPages, Math.floor(Number(e.target.value) || 1))))}
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {needsLocation && (
                                <>
                                    <div className="space-y-2">
                                        <Label>{t('mode')}</Label>
                                        <RadioGroup value={mode} onValueChange={v => setMode(v as 'onsite' | 'remote')} className="flex flex-wrap gap-6">
                                            {interpreter.serviceProvinces.length > 0 && (
                                                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="onsite" /> {t('onsite')}</label>
                                            )}
                                            {interpreter.remoteAvailable && (
                                                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="remote" /> {t('remoteMode')}</label>
                                            )}
                                        </RadioGroup>
                                    </div>
                                    {mode === 'onsite' && (
                                        <div className="grid sm:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label>{t('province')}</Label>
                                                <Select value={province} onValueChange={setProvince}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {interpreter.serviceProvinces.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2 sm:col-span-2">
                                                <Label htmlFor="address">{t('address')}</Label>
                                                <Input id="address" value={address} maxLength={500} onChange={e => setAddress(e.target.value)} />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {kind === 'translation' && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="due">{t('dueDate')}</Label>
                                        <Input id="due" type="date" min={minDate} max={maxDate} value={dueDate} onChange={e => setDueDate(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('documents')}{unit !== 'page' && ` (${t('optional')})`}</Label>
                                        <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-2xl p-5 cursor-pointer hover:bg-slate-50 text-sm">
                                            {uploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                            {uploadingDoc ? t('uploading') : t('uploadDocuments')}
                                            <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only"
                                                disabled={uploadingDoc} onChange={e => handleDocUpload(e.target.files)} />
                                        </label>
                                        {documentPaths.map(d => (
                                            <p key={d.path} className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="w-4 h-4" /> {d.name}</p>
                                        ))}
                                    </div>
                                </>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="notes">{t('notes')}</Label>
                                <Textarea id="notes" value={notes} maxLength={2000} placeholder={t('notesPlaceholder')} onChange={e => setNotes(e.target.value)} />
                            </div>

                            <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                                <div>
                                    <p className="font-semibold text-sm">{t('contactTitle')}</p>
                                    <p className="text-xs text-muted-foreground">{t('contactHint')}</p>
                                </div>
                                <div className="grid sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="cname" className="text-xs">{t('contactName')}</Label>
                                        <Input id="cname" value={contactName} maxLength={100} onChange={e => setContactName(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="cphone" className="text-xs">{t('contactPhone')}</Label>
                                        <Input id="cphone" type="tel" value={contactPhone} maxLength={30} onChange={e => setContactPhone(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="cline" className="text-xs">{t('contactLineId')}</Label>
                                        <Input id="cline" value={contactLineId} maxLength={50} onChange={e => setContactLineId(e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground">{t('policy')}</p>

                            <Button className="w-full bg-[#0B3979] hover:bg-[#0B3979]/90" size="lg" disabled={!canQuote || loadingQuote} onClick={handleQuote}>
                                {loadingQuote && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {t('getQuote')}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {step === 2 && quote && (
                    <div className="space-y-6">
                        <Card className="rounded-3xl border-none shadow-sm">
                            <CardHeader><CardTitle>{t('quoteTitle')}</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">{quote.itemName} · {l.service(activeService)}</span>
                                    <span className="whitespace-nowrap">
                                        {quote.unitType === 'hour' || quote.unitType === 'day' || quote.unitType === 'page'
                                            ? t('unitLine', { units: unitsLabel(quote), rate: l.satang(quote.unitRate) })
                                            : `฿${l.satang(quote.unitRate)}`}
                                    </span>
                                </div>
                                <div className="flex justify-between border-t pt-3 text-lg font-bold">
                                    <span>{t('total')}</span>
                                    <span className="text-[#0B3979]">฿{l.satang(quote.grossAmount)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {paymentAccount ? (
                            <Card className="rounded-3xl border-none shadow-sm">
                                <CardHeader>
                                    <CardTitle>{t('payTitle')}</CardTitle>
                                    <p className="text-sm text-muted-foreground">{t('payHint')}</p>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="rounded-2xl bg-slate-50 p-4 space-y-3 text-sm">
                                        <div className="flex justify-between"><span className="text-muted-foreground">{t('bank')}</span><span className="font-semibold">{paymentAccount.bankName}</span></div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">{t('accountNumber')}</span>
                                            <span className="flex items-center gap-2 font-bold text-lg text-[#0B3979]">
                                                {paymentAccount.accountNumber}
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(paymentAccount.accountNumber)} aria-label={t('copy')}>
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                            </span>
                                        </div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">{t('accountName')}</span><span className="font-semibold">{paymentAccount.accountName}</span></div>
                                    </div>
                                    <SlipUpload expectedBaht={quote.grossAmount / 100} value={slip} onChange={setSlip} />
                                    <div className="flex gap-3">
                                        <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>{t('back')}</Button>
                                        <Button
                                            className="flex-1 bg-[#0B3979] hover:bg-[#0B3979]/90"
                                            size="lg"
                                            disabled={!slip.file || slip.status === 'checking' || slip.status === 'mismatch' || submitting}
                                            onClick={handleConfirm}
                                        >
                                            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('submitting')}</> : t('confirm')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="rounded-3xl border-none shadow-sm">
                                <CardContent className="p-6 text-sm text-amber-800 bg-amber-50 rounded-3xl">{t('paymentNotReady')}</CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
