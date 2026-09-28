'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import interpreterHero from '@/pic/lawslane-interpreter.webp';
import { Languages, Scale, ClipboardList, MessagesSquare, UserCheck, Loader2, LogIn } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useInterpreterLabels } from '@/components/interpreter/use-interpreter-labels';
import { INTERPRETER_LANGUAGE_CODES, INTERPRETER_SERVICES } from '@/lib/interpreter-types';
import { createInterpreterRequestAction } from '@/app/actions/interpreter-request-actions';

/**
 * บริการล่าม — ไม่แสดงรายชื่อล่าม/ราคา/การจองเองบนเว็บ
 * ลูกค้าบอกงานผ่านแบบฟอร์ม → เปิดตั๋วแชทกับแอดมิน (/support/{id}) → แอดมินจัดหาล่ามและเสนอราคาเอง
 */
export function InterpretersPageClient() {
    const t = useTranslations('Interpreters');
    const r = useTranslations('Interpreters.request');
    const l = useInterpreterLabels();
    const router = useRouter();
    const { toast } = useToast();
    const { user, isUserLoading } = useUser();

    const [service, setService] = useState('');
    const [languageFrom, setLanguageFrom] = useState('');
    const [languageTo, setLanguageTo] = useState('th');
    const [date, setDate] = useState('');
    const [mode, setMode] = useState<'onsite' | 'remote'>('onsite');
    const [location, setLocation] = useState('');
    const [phone, setPhone] = useState('');
    const [details, setDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);
    // ทนายส่งลูกความมาขอล่ามให้เคส (?lawyerId=) — อ่านหลัง mount ไม่ใช้ useSearchParams (หน้าจะหลุดเป็น client render)
    const [lawyerId, setLawyerId] = useState('');
    useEffect(() => {
        setLawyerId(new URLSearchParams(window.location.search).get('lawyerId') || '');
    }, []);

    const steps = [
        { icon: ClipboardList, title: r('step1Title'), body: r('step1Body') },
        { icon: MessagesSquare, title: r('step2Title'), body: r('step2Body') },
        { icon: UserCheck, title: r('step3Title'), body: r('step3Body') },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!service || !languageFrom || !languageTo) {
            toast({ variant: 'destructive', title: r('required') });
            return;
        }
        setSubmitting(true);
        try {
            const { ticketId } = await createInterpreterRequestAction({
                service, languageFrom, languageTo, date, mode, location, phone, details, lawyerId,
            });
            router.push(`/support/${ticketId}`);
        } catch {
            toast({ variant: 'destructive', title: r('error') });
            setSubmitting(false);
        }
    };

    const loginHref = `/login?redirect=${encodeURIComponent('/interpreters')}`;

    return (
        <div className="bg-gray-50 min-h-screen">
            <section className="relative bg-slate-900 text-white overflow-hidden rounded-b-[40px] md:rounded-b-none">
                <div className="md:hidden absolute inset-x-0 top-0 h-[340px] pointer-events-none">
                    <Image src={interpreterHero} alt="" fill priority sizes="100vw" className="object-contain object-top opacity-80" />
                    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent" />
                </div>
                <div className="relative container mx-auto px-4 md:px-6 max-w-6xl md:grid md:grid-cols-[1fr_auto] md:items-end md:gap-8">
                    <div className="pt-[250px] pb-10 text-center md:text-left md:py-16">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-4 text-gray-400">
                            <Languages className="w-6 h-6" />
                            <span className="text-sm font-semibold uppercase tracking-wider">Lawslane</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold font-headline">{t('heroTitle')}</h1>
                        <p className="mt-3 text-gray-300 max-w-2xl mx-auto md:mx-0">{t('heroSubtitle')}</p>
                        <Button asChild size="lg" className="mt-6 rounded-full bg-white text-slate-900 hover:bg-gray-100 font-semibold">
                            <a href="#request">{r('formTitle')}</a>
                        </Button>
                    </div>
                    <Image
                        src={interpreterHero}
                        alt=""
                        priority
                        sizes="(min-width: 1024px) 280px, 240px"
                        className="hidden md:block w-[240px] lg:w-[280px] h-auto self-end"
                    />
                </div>
            </section>

            <div className="container mx-auto px-4 md:px-6 py-10 max-w-6xl space-y-12">
                {/* ขั้นตอน */}
                <section>
                    <h2 className="text-2xl font-bold text-[#0B3979] text-center mb-6">{r('howTitle')}</h2>
                    <ol className="grid gap-4 md:grid-cols-3">
                        {steps.map((s, i) => (
                            <li key={s.title} className="bg-white rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="w-8 h-8 rounded-full bg-[#0B3979] text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
                                    <s.icon className="w-5 h-5 text-[#0B3979]" />
                                    <h3 className="font-semibold text-slate-800">{s.title}</h3>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* บริการ */}
                <section>
                    <h2 className="text-2xl font-bold text-[#0B3979] text-center mb-6">{r('servicesTitle')}</h2>
                    <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                        {INTERPRETER_SERVICES.map((s) => (
                            <div key={s} className="bg-white rounded-xl px-4 py-3 shadow-sm text-sm font-medium text-slate-700 flex items-center gap-2">
                                <Languages className="w-4 h-4 text-[#0B3979] shrink-0" />
                                {l.service(s)}
                            </div>
                        ))}
                    </div>
                </section>

                {/* แบบฟอร์มขอใช้บริการ → แชทกับแอดมิน */}
                <section id="request" className="scroll-mt-24">
                    <div className="bg-white rounded-3xl shadow-sm p-6 md:p-8 max-w-3xl mx-auto">
                        <h2 className="text-2xl font-bold text-[#0B3979]">{r('formTitle')}</h2>
                        <p className="text-sm text-slate-500 mt-1 mb-6">{r('formSubtitle')}</p>

                        {lawyerId && (
                            <div className="mb-6 flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-900">
                                <Scale className="w-4 h-4 flex-shrink-0" /> {r('forLawyerNote')}
                            </div>
                        )}

                        {!isUserLoading && !user ? (
                            <div className="rounded-2xl border border-slate-200 p-6 text-center">
                                <p className="text-slate-600 mb-4">{r('loginRequired')}</p>
                                <Button asChild className="rounded-full bg-[#0B3979] hover:bg-[#082a5a] gap-2">
                                    <Link href={loginHref}><LogIn className="w-4 h-4" />{r('loginButton')}</Link>
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label>{r('service')}</Label>
                                    <Select value={service} onValueChange={setService}>
                                        <SelectTrigger><SelectValue placeholder={r('select')} /></SelectTrigger>
                                        <SelectContent>
                                            {INTERPRETER_SERVICES.map((s) => <SelectItem key={s} value={s}>{l.service(s)}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>{r('languageFrom')}</Label>
                                    <Select value={languageFrom} onValueChange={setLanguageFrom}>
                                        <SelectTrigger><SelectValue placeholder={r('select')} /></SelectTrigger>
                                        <SelectContent>
                                            {INTERPRETER_LANGUAGE_CODES.map((c) => <SelectItem key={c} value={c}>{l.language(c)}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>{r('languageTo')}</Label>
                                    <Select value={languageTo} onValueChange={setLanguageTo}>
                                        <SelectTrigger><SelectValue placeholder={r('select')} /></SelectTrigger>
                                        <SelectContent>
                                            {INTERPRETER_LANGUAGE_CODES.map((c) => <SelectItem key={c} value={c}>{l.language(c)}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="req-date">{r('date')}</Label>
                                    <Input id="req-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>{r('mode')}</Label>
                                    <Select value={mode} onValueChange={(v) => setMode(v as 'onsite' | 'remote')}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="onsite">{r('onsite')}</SelectItem>
                                            <SelectItem value="remote">{r('remote')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="req-location">{r('location')}</Label>
                                    <Input id="req-location" value={location} maxLength={200} placeholder={r('locationPlaceholder')} onChange={(e) => setLocation(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="req-phone">{r('phone')}</Label>
                                    <Input id="req-phone" type="tel" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label htmlFor="req-details">{r('details')}</Label>
                                    <Textarea id="req-details" rows={4} value={details} maxLength={1000} placeholder={r('detailsPlaceholder')} onChange={(e) => setDetails(e.target.value)} />
                                </div>
                                <div className="md:col-span-2">
                                    <Button type="submit" disabled={submitting} className="w-full h-12 rounded-full bg-[#0B3979] hover:bg-[#082a5a] text-base font-semibold gap-2">
                                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessagesSquare className="w-5 h-5" />}
                                        {submitting ? r('submitting') : r('submit')}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </section>

                <div className="text-center">
                    <Link href="/for-interpreters" className="text-sm font-semibold text-[#0B3979] hover:underline">
                        {t('becomeInterpreter')} →
                    </Link>
                </div>
            </div>
        </div>
    );
}
