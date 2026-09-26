'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import interpreterHero from '@/pic/lawslane-interpreter.webp';
import { CalendarCheck, CheckCircle2, FileCheck2, Loader2, Upload, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import {
    getMyInterpreterProfileAction,
    registerInterpreterAction,
    uploadInterpreterFileAction,
} from '@/app/actions/interpreter-profile-actions';
import {
    EMPTY_PROFILE_VALUES,
    InterpreterProfileFields,
    defaultRateCard,
    type InterpreterProfileValues,
} from '@/components/interpreter/interpreter-profile-fields';
import { ProfilePhotoPicker } from '@/components/interpreter/profile-photo-picker';

function FileField({ label, uploaded, onFile, busy }: { label: string; uploaded: string[]; onFile: (f: File) => void; busy: boolean }) {
    const t = useTranslations('ForInterpreters');
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer hover:bg-slate-50 text-sm">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {t('upload')}
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" disabled={busy}
                    onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
            </label>
            {uploaded.map(name => (
                <p key={name} className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" /> {name}</p>
            ))}
        </div>
    );
}

export default function ForInterpretersClient({ gpPercent }: { gpPercent: number }) {
    const t = useTranslations('ForInterpreters');
    const { toast } = useToast();
    const { user, isUserLoading } = useUser();

    const [alreadyApplied, setAlreadyApplied] = useState<boolean | null>(null);
    const [values, setValues] = useState<InterpreterProfileValues>(() => ({
        ...EMPTY_PROFILE_VALUES,
        rateCard: defaultRateCard({ hour: t('defaultRateHour'), day: t('defaultRateDay') }),
    }));
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [lineId, setLineId] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [idCard, setIdCard] = useState<{ path: string; name: string } | null>(null);
    const [certs, setCerts] = useState<{ path: string; name: string }[]>([]);
    const [uploading, setUploading] = useState<string | null>(null);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptSiteTerms, setAcceptSiteTerms] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!user) return;
        setName(prev => prev || user.displayName || '');
        getMyInterpreterProfileAction().then(p => setAlreadyApplied(!!p));
    }, [user]);

    const upload = async (file: File, kind: 'id' | 'cert') => {
        setUploading(kind);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await uploadInterpreterFileAction(fd, 'credential');
            if (!res.ok) return toast({ variant: 'destructive', title: res.error });
            if (kind === 'id') setIdCard({ path: res.path, name: file.name });
            else setCerts(prev => [...prev, { path: res.path, name: file.name }]);
        } catch (e: any) {
            toast({ variant: 'destructive', title: e?.message || 'Upload failed' });
        } finally {
            setUploading(null);
        }
    };

    const submit = async () => {
        setSubmitting(true);
        const res = await registerInterpreterAction({
            ...values,
            name,
            phone,
            lineId,
            imageUrl,
            idCardPath: idCard?.path || '',
            certificatePaths: certs.map(c => c.path),
            acceptTerms,
            acceptSiteTerms,
        });
        setSubmitting(false);
        if (!res.ok) return toast({ variant: 'destructive', title: res.error });
        setDone(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const benefits = [
        { icon: <Wallet className="w-6 h-6" />, title: t('benefit1Title'), text: t('benefit1') },
        { icon: <FileCheck2 className="w-6 h-6" />, title: t('benefit2Title'), text: t('benefit2') },
        { icon: <CalendarCheck className="w-6 h-6" />, title: t('benefit3Title'), text: t('benefit3') },
    ];

    return (
        <div className="bg-gray-50 min-h-screen">
            <section className="relative bg-[#0B3979] text-white overflow-hidden rounded-b-[40px] md:rounded-b-none">
                <div className="md:hidden absolute inset-x-0 top-0 h-[340px] pointer-events-none">
                    <Image src={interpreterHero} alt="" fill priority sizes="100vw" className="object-contain object-top opacity-80" />
                    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0B3979] via-[#0B3979]/80 to-transparent" />
                </div>
                <div className="relative container mx-auto px-4 md:px-6 max-w-5xl md:grid md:grid-cols-[1fr_auto] md:items-end md:gap-8">
                    <div className="pt-[250px] pb-10 text-center md:text-left md:py-14">
                        <h1 className="text-3xl md:text-4xl font-bold font-headline">{t('heroTitle')}</h1>
                        <p className="mt-3 text-blue-100 max-w-2xl mx-auto md:mx-0">{t('heroSubtitle')}</p>
                    </div>
                    <Image
                        src={interpreterHero}
                        alt=""
                        priority
                        sizes="(min-width: 1024px) 260px, 220px"
                        className="hidden md:block w-[220px] lg:w-[260px] h-auto self-end"
                    />
                </div>
            </section>

            <div className="container mx-auto px-4 md:px-6 py-10 max-w-5xl space-y-10">
                <div className="grid md:grid-cols-3 gap-6">
                    {benefits.map(b => (
                        <Card key={b.title} className="rounded-2xl border-none shadow-sm">
                            <CardContent className="p-6 space-y-2">
                                <div className="text-[#0B3979]">{b.icon}</div>
                                <p className="font-bold">{b.title}</p>
                                <p className="text-sm text-muted-foreground">{b.text}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="rounded-2xl border-none shadow-sm bg-blue-50">
                    <CardContent className="p-6 space-y-1">
                        <p className="font-bold text-[#0B3979]">{t('feeTitle')}</p>
                        <p className="text-sm">{t('feeText', { percent: gpPercent })}</p>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-none shadow-sm" id="apply">
                    <CardHeader><CardTitle>{t('formTitle')}</CardTitle></CardHeader>
                    <CardContent>
                        {/* ไม่รอ isUserLoading ถ้ารู้ user แล้ว — provider ค้าง isUserLoading=true เมื่อมี session cookie
                            แต่ Firebase ฝั่ง browser ยังไม่ล็อกอิน (SSO ข้าม subdomain) หน้านี้ใช้ server action ล้วนจึงไปต่อได้ */}
                        {(!user && isUserLoading) || (user && alreadyApplied === null) ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
                        ) : !user ? (
                            <div className="text-center space-y-4 py-6">
                                <p className="text-muted-foreground">{t('loginFirst')}</p>
                                <Button asChild className="bg-[#0B3979]">
                                    <Link href={`/login?redirect=${encodeURIComponent('/for-interpreters#apply')}`}>{t('loginButton')}</Link>
                                </Button>
                            </div>
                        ) : done || alreadyApplied ? (
                            <div className="text-center space-y-3 py-6">
                                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                                <p className="font-bold text-lg">{done ? t('successTitle') : t('alreadyApplied')}</p>
                                {done && <p className="text-muted-foreground">{t('successText')}</p>}
                                <Button asChild variant="outline"><Link href="/interpreter-dashboard">{t('goDashboard')}</Link></Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <ProfilePhotoPicker value={imageUrl} onChange={setImageUrl} />
                                <div className="grid sm:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">{t('name')}</Label>
                                        <Input id="name" value={name} maxLength={100} onChange={e => setName(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">{t('phone')}</Label>
                                        <Input id="phone" type="tel" value={phone} maxLength={30} onChange={e => setPhone(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="line">{t('lineId')}</Label>
                                        <Input id="line" value={lineId} maxLength={50} onChange={e => setLineId(e.target.value)} />
                                    </div>
                                </div>

                                <InterpreterProfileFields value={values} onChange={setValues} gpPercent={gpPercent} />

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <FileField label={t('idCard')} uploaded={idCard ? [idCard.name] : []} busy={uploading === 'id'} onFile={f => upload(f, 'id')} />
                                    <FileField label={t('certificates')} uploaded={certs.map(c => c.name)} busy={uploading === 'cert'} onFile={f => upload(f, 'cert')} />
                                </div>

                                <label className="flex items-start gap-3 text-sm">
                                    <Checkbox checked={acceptTerms} onCheckedChange={c => setAcceptTerms(c === true)} className="mt-0.5" />
                                    <span>{t('terms')} ({gpPercent}%)</span>
                                </label>

                                <label className="flex items-start gap-3 text-sm">
                                    <Checkbox checked={acceptSiteTerms} onCheckedChange={c => setAcceptSiteTerms(c === true)} className="mt-0.5" />
                                    <span>
                                        {/* เปิดแท็บใหม่ — ไม่ให้ข้อมูลที่กรอก/ไฟล์ที่อัปโหลดไว้หาย */}
                                        {t.rich('siteTerms', {
                                            terms: chunks => <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#0B3979] underline underline-offset-2">{chunks}</Link>,
                                            privacy: chunks => <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0B3979] underline underline-offset-2">{chunks}</Link>,
                                        })}
                                    </span>
                                </label>

                                <Button
                                    size="lg"
                                    className="w-full bg-[#0B3979] hover:bg-[#0B3979]/90"
                                    disabled={submitting || !acceptTerms || !acceptSiteTerms || !idCard || !!uploading}
                                    onClick={submit}
                                >
                                    {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('submitting')}</> : t('submit')}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
