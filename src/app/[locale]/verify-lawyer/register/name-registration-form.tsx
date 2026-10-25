'use client'

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Link } from '@/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { THAI_PROVINCES } from '@/lib/thai-provinces';
import { submitLawyerNameRegistrationAction, type NameRegistrationResult } from '@/app/actions/lawyer-name-registration-actions';

// ค่าที่ส่งไป server เป็นภาษาไทยเสมอ (เก็บในทะเบียนแบบเดียวกับรายชื่อจากสภาทนายความ) — ป้ายแปลตาม locale
const PREFIXES = [
    { value: 'นาย', key: 'mr' },
    { value: 'นาง', key: 'mrs' },
    { value: 'นางสาว', key: 'ms' },
    { value: 'ว่าที่ร้อยตรี', key: 'actingSubLt' },
    { value: 'ว่าที่ร้อยตรีหญิง', key: 'actingSubLtFemale' },
    { value: 'ดร.', key: 'dr' },
] as const;

const EMPTY = { prefix: '', firstName: '', lastName: '', licenseNumber: '', province: '', phone: '', email: '' };

export function NameRegistrationForm() {
    const t = useTranslations('LawyerNameRegistration');
    const locale = useLocale();
    const [form, setForm] = useState(EMPTY);
    const [consent, setConsent] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<Exclude<NameRegistrationResult, { ok: true }>['reason'] | null>(null);
    const [done, setDone] = useState(false);

    const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const res = await submitLawyerNameRegistrationAction({ ...form, consent, locale });
            if (res.ok) {
                setDone(true);
                setForm(EMPTY);
                setConsent(false);
            } else {
                setError(res.reason);
            }
        } catch {
            setError('error');
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <Card className="shadow-xl rounded-2xl border-none bg-white">
                <CardContent className="p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-9 h-9" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">{t('successTitle')}</h2>
                    <p className="text-slate-600 max-w-md mx-auto leading-relaxed">{t('successBody')}</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                        <Button asChild className="rounded-full bg-[#0B3979] hover:bg-[#082a5a] text-white px-8">
                            <Link href="/verify-lawyer">{t('successBack')}</Link>
                        </Button>
                        <Button variant="outline" className="rounded-full px-8" onClick={() => setDone(false)}>
                            {t('successAnother')}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const inputClass = 'h-11 rounded-xl border-slate-200 bg-[#F8FAFC] focus:bg-white';

    return (
        <Card className="shadow-xl rounded-2xl border-none bg-white">
            <CardContent className="p-6 md:p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-[160px_1fr_1fr]">
                        <div className="space-y-1.5">
                            <Label htmlFor="reg-prefix" className="text-sm font-bold text-[#0B3979]">{t('prefix')}</Label>
                            <Select value={form.prefix} onValueChange={set('prefix')} disabled={submitting}>
                                <SelectTrigger id="reg-prefix" className={inputClass}>
                                    <SelectValue placeholder={t('prefixPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {PREFIXES.map((p) => (
                                        <SelectItem key={p.key} value={p.value}>{t(`prefixes.${p.key}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="reg-first" className="text-sm font-bold text-[#0B3979]">{t('firstName')} *</Label>
                            <Input id="reg-first" required maxLength={100} value={form.firstName} onChange={(e) => set('firstName')(e.target.value)} disabled={submitting} className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="reg-last" className="text-sm font-bold text-[#0B3979]">{t('lastName')} *</Label>
                            <Input id="reg-last" required maxLength={100} value={form.lastName} onChange={(e) => set('lastName')(e.target.value)} disabled={submitting} className={inputClass} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 -mt-2">{t('nameHint')}</p>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="reg-license" className="text-sm font-bold text-[#0B3979]">{t('licenseNumber')} *</Label>
                            <Input id="reg-license" required maxLength={30} inputMode="numeric" placeholder={t('licensePlaceholder')} value={form.licenseNumber} onChange={(e) => set('licenseNumber')(e.target.value)} disabled={submitting} className={inputClass} />
                            <p className="text-xs text-slate-500">{t('licenseHint')}</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="reg-province" className="text-sm font-bold text-[#0B3979]">{t('province')}</Label>
                            <Select value={form.province} onValueChange={set('province')} disabled={submitting}>
                                <SelectTrigger id="reg-province" className={inputClass}>
                                    <SelectValue placeholder={t('provincePlaceholder')} />
                                </SelectTrigger>
                                <SelectContent className="max-h-72">
                                    {THAI_PROVINCES.map((r) => (
                                        <SelectGroup key={r.region}>
                                            <SelectLabel>{r.region}</SelectLabel>
                                            {r.provinces.map((p) => (
                                                <SelectItem key={p} value={p}>{p}</SelectItem>
                                            ))}
                                        </SelectGroup>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-4">
                        <p className="text-xs text-slate-600 leading-relaxed">{t('contactNote')}</p>
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="reg-phone" className="text-sm font-bold text-[#0B3979]">{t('phone')} *</Label>
                                <Input id="reg-phone" type="tel" required maxLength={20} inputMode="tel" value={form.phone} onChange={(e) => set('phone')(e.target.value)} disabled={submitting} className="h-11 rounded-xl border-slate-200 bg-white" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="reg-email" className="text-sm font-bold text-[#0B3979]">{t('email')}</Label>
                                <Input id="reg-email" type="email" maxLength={254} value={form.email} onChange={(e) => set('email')(e.target.value)} disabled={submitting} className="h-11 rounded-xl border-slate-200 bg-white" />
                            </div>
                        </div>
                    </div>

                    {/* ไม่ครอบ Checkbox ด้วย <label> — คลิกครั้งเดียวจะสลับสองรอบ (ปุ่มของ Radix + label ส่งคลิกต่อ) */}
                    <div className="flex items-start gap-3">
                        <Checkbox id="reg-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} disabled={submitting} className="mt-0.5" />
                        <p className="text-sm text-slate-700 leading-relaxed">
                            <Label htmlFor="reg-consent" className="font-normal leading-relaxed cursor-pointer">{t('consent')}</Label>{' '}
                            <Link href="/privacy" className="text-[#0B3979] underline underline-offset-2">{t('privacyLink')}</Link>
                        </p>
                    </div>

                    {error && (
                        <div role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>
                                {t(`errors.${error}`)}
                                {(error === 'already_listed' || error === 'on_lawslane') && (
                                    <>
                                        {' '}
                                        <Link href={`/verify-lawyer?licenseNumber=${encodeURIComponent(form.licenseNumber.trim())}`} className="font-semibold underline underline-offset-2">
                                            {t('viewListing')}
                                        </Link>
                                    </>
                                )}
                            </span>
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={submitting || !consent}
                        className="w-full h-12 rounded-full text-base font-semibold bg-[#0B3979] hover:bg-[#082a5a] text-white shadow-lg shadow-blue-900/20"
                    >
                        {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                        {t('submit')}
                    </Button>
                    <p className="text-xs text-slate-500 text-center">{t('freeNote')}</p>
                </form>
            </CardContent>
        </Card>
    );
}
