'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import interpreterHero from '@/pic/lawslane-interpreter.webp';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Languages, Scale } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InterpreterCard } from '@/components/interpreter/interpreter-card';
import { TIER_RANK } from '@/lib/provider-plans';
import { useInterpreterLabels } from '@/components/interpreter/use-interpreter-labels';
import { THAI_PROVINCES } from '@/lib/thai-provinces';
import { INTERPRETER_LANGUAGE_CODES, INTERPRETER_SERVICES, type PublicInterpreter } from '@/lib/interpreter-types';

const ALL = '__all';
const PROVINCES = THAI_PROVINCES.flatMap(r => r.provinces).sort((a, b) => a.localeCompare(b, 'th'));

export function InterpretersPageClient({ interpreters }: { interpreters: PublicInterpreter[] }) {
    const t = useTranslations('Interpreters');
    const l = useInterpreterLabels();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const language = searchParams.get('lang') || '';
    const service = searchParams.get('service') || '';
    const province = searchParams.get('province') || '';
    const remoteOnly = searchParams.get('remote') === '1';
    const lawyerId = searchParams.get('lawyerId') || '';

    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(searchParams.toString());
        if (value) next.set(key, value); else next.delete(key);
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    };

    const filtered = useMemo(() => interpreters
        .filter(i => !language || i.languageCodes.includes(language as any))
        .filter(i => !service || i.services.includes(service as any))
        .filter(i => !province || i.serviceProvinces.includes(province) || i.remoteAvailable)
        .filter(i => !remoteOnly || i.remoteAvailable)
        // แพลนพรีเมียม → Pro → ตรวจเอกสารแล้ว → คะแนน
        .sort((a, b) =>
            TIER_RANK[b.planTier || 'free'] - TIER_RANK[a.planTier || 'free']
            || (b.verifiedCredentials.length > 0 ? 1 : 0) - (a.verifiedCredentials.length > 0 ? 1 : 0)
            || (b.averageRating ?? 0) - (a.averageRating ?? 0)),
        [interpreters, language, service, province, remoteOnly]);

    // ส่ง lawyerId ต่อไปถึงหน้าจอง เพื่อผูกงานล่ามกับทนายของเคส
    const cardQuery = lawyerId ? `lawyerId=${encodeURIComponent(lawyerId)}` : '';

    return (
        <div className="bg-gray-50 min-h-screen">
            <section className="bg-[#0B3979] text-white overflow-hidden">
                <div className="container mx-auto px-4 md:px-6 max-w-6xl md:grid md:grid-cols-[1fr_auto] md:items-end md:gap-8">
                    <div className="py-12 md:py-16">
                        <div className="flex items-center gap-3 mb-4 text-blue-200">
                            <Languages className="w-6 h-6" />
                            <span className="text-sm font-semibold uppercase tracking-wider">Lawslane</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold font-headline">{t('heroTitle')}</h1>
                        <p className="mt-3 text-blue-100 max-w-2xl">{t('heroSubtitle')}</p>
                    </div>
                    <Image
                        src={interpreterHero}
                        alt=""
                        priority
                        sizes="(min-width: 768px) 280px, 0px"
                        className="hidden md:block w-[240px] lg:w-[280px] h-auto self-end"
                    />
                </div>
            </section>

            <div className="container mx-auto px-4 md:px-6 py-8 max-w-6xl">
                {lawyerId && (
                    <div className="mb-6 flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-900">
                        <Scale className="w-4 h-4 flex-shrink-0" /> {t('forLawyerBanner')}
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm p-4 md:p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
                    <div className="space-y-1.5">
                        <Label>{t('filterLanguage')}</Label>
                        <Select value={language || ALL} onValueChange={v => setParam('lang', v === ALL ? '' : v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t('all')}</SelectItem>
                                {INTERPRETER_LANGUAGE_CODES.filter(c => c !== 'th').map(c => (
                                    <SelectItem key={c} value={c}>{l.language(c)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>{t('filterService')}</Label>
                        <Select value={service || ALL} onValueChange={v => setParam('service', v === ALL ? '' : v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t('all')}</SelectItem>
                                {INTERPRETER_SERVICES.map(s => <SelectItem key={s} value={s}>{l.service(s)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>{t('filterProvince')}</Label>
                        <Select value={province || ALL} onValueChange={v => setParam('province', v === ALL ? '' : v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t('all')}</SelectItem>
                                {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center justify-between gap-3 h-10">
                        <label className="flex items-center gap-2 text-sm">
                            <Switch checked={remoteOnly} onCheckedChange={v => setParam('remote', v ? '1' : '')} />
                            {t('filterRemote')}
                        </label>
                        {(language || service || province || remoteOnly) && (
                            <Button variant="ghost" size="sm" onClick={() => router.replace(lawyerId ? `${pathname}?lawyerId=${encodeURIComponent(lawyerId)}` : pathname)}>
                                {t('clearFilters')}
                            </Button>
                        )}
                    </div>
                </div>

                <p className="text-sm text-muted-foreground mt-6 mb-4">{t('resultsCount', { count: filtered.length })}</p>

                {filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
                        <p className="font-semibold text-slate-800">{t('empty')}</p>
                        <p className="text-sm text-muted-foreground mt-2">{t('emptyHint')}</p>
                        <Button asChild variant="outline" className="mt-4"><Link href="/support">{t('contactSupport')}</Link></Button>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map(i => <InterpreterCard key={i.id} interpreter={i} query={cardQuery} />)}
                    </div>
                )}

                <div className="mt-12 text-center">
                    <Link href="/for-interpreters" className="text-sm font-semibold text-[#0B3979] hover:underline">
                        {t('becomeInterpreter')} →
                    </Link>
                </div>
            </div>
        </div>
    );
}
