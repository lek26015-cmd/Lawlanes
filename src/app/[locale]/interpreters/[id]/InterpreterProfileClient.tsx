'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, BadgeCheck, CalendarClock, Globe2, Info, Loader2, MapPin, MessageCircle, Scale } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useInterpreterLabels } from '@/components/interpreter/use-interpreter-labels';
import { useToast } from '@/hooks/use-toast';
import { startInterpreterConversationAction } from '@/app/actions/interpreter-chat-actions';
import { getCloudflareVariantUrl } from '@/lib/cloudflare-images';
import profileImg from '@/pic/profile-lawyer.jpg';
import type { PublicInterpreter } from '@/lib/interpreter-types';

export default function InterpreterProfileClient({ interpreter }: { interpreter: PublicInterpreter }) {
    const t = useTranslations('Interpreters');
    const l = useInterpreterLabels();
    const searchParams = useSearchParams();
    const lawyerId = searchParams.get('lawyerId');

    const router = useRouter();
    const { toast } = useToast();
    const [openingChat, setOpeningChat] = useState(false);
    const withLawyer = (href: string) => (lawyerId ? `${href}${href.includes('?') ? '&' : '?'}lawyerId=${encodeURIComponent(lawyerId)}` : href);

    // คุยผ่านแพลตฟอร์มก่อนจอง — ข้อมูลติดต่อเปิดให้เห็นหลังจ่ายเงินแล้วเท่านั้น
    const openChat = async () => {
        setOpeningChat(true);
        const res = await startInterpreterConversationAction(interpreter.id);
        setOpeningChat(false);
        if (res.ok) return router.push(`/interpreter-chat/${res.conversationId}`);
        if (res.error.includes('เข้าสู่ระบบ')) return router.push(`/login?redirect=${encodeURIComponent(`/interpreters/${interpreter.id}`)}`);
        toast({ variant: 'destructive', title: res.error });
    };
    const bookHref = withLawyer(`/interpreters/${interpreter.id}/book`);
    const verified = interpreter.verifiedCredentials.length > 0;

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="container mx-auto px-4 md:px-6 py-10 max-w-4xl">
                <Link href={`/interpreters${lawyerId ? `?lawyerId=${encodeURIComponent(lawyerId)}` : ''}`} className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> {t('backToList')}
                </Link>

                <Card className="rounded-3xl shadow-sm border-none overflow-hidden">
                    <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 md:gap-8">
                        <div className="relative h-28 w-28 flex-shrink-0">
                            <Image
                                src={getCloudflareVariantUrl(interpreter.imageUrl, 'public') || profileImg}
                                alt={interpreter.name}
                                fill
                                sizes="112px"
                                className="rounded-full object-cover border-4 border-white shadow-lg"
                                priority
                            />
                        </div>
                        <div className="text-center md:text-left flex-grow min-w-0">
                            <h1 className="text-2xl md:text-3xl font-bold font-headline">{interpreter.name}</h1>
                            {verified && (
                                <p className="mt-1 inline-flex items-center gap-1 text-sm text-emerald-700">
                                    <BadgeCheck className="w-4 h-4" /> {t('verifiedBadge')}
                                </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2 justify-center md:justify-start">
                                {interpreter.languages.map(lang => (
                                    <Badge key={lang.code} variant="secondary">
                                        {l.language(lang.code)} · {l.level(lang.level)}
                                    </Badge>
                                ))}
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">
                                {interpreter.reviewCount ? t('reviews', { count: interpreter.reviewCount }) : t('noReviews')}
                            </p>
                        </div>
                        <div className="w-full md:w-48 flex-shrink-0 space-y-2">
                            <Button asChild size="lg" className="w-full bg-[#0B3979] hover:bg-[#0B3979]/90">
                                <Link href={bookHref}>{t('bookNow')}</Link>
                            </Button>
                            <Button variant="outline" className="w-full" disabled={openingChat} onClick={openChat}>
                                {openingChat ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
                                {t('chatWithInterpreter')}
                            </Button>
                        </div>
                    </div>
                </Card>

                {lawyerId && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-900">
                        <Scale className="w-4 h-4 flex-shrink-0" /> {t('forLawyerBanner')}
                    </div>
                )}

                <div className="grid md:grid-cols-3 gap-6 mt-6">
                    <Card className="md:col-span-2 rounded-3xl shadow-sm border-none">
                        <CardHeader><CardTitle>{t('about')}</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <p className="text-muted-foreground whitespace-pre-line">{l.description(interpreter)}</p>
                            <div>
                                <h3 className="font-semibold mb-2">{t('services')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {interpreter.services.map(s => <Badge key={s} variant="outline">{l.service(s)}</Badge>)}
                                </div>
                            </div>
                            {interpreter.specialties.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-2">{t('specialties')}</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {interpreter.specialties.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
                                    </div>
                                </div>
                            )}
                            <div>
                                <h3 className="font-semibold mb-2">{t('provinces')}</h3>
                                <p className="text-sm text-muted-foreground flex items-start gap-2">
                                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    {interpreter.serviceProvinces.length ? interpreter.serviceProvinces.join(', ') : '—'}
                                </p>
                                {interpreter.remoteAvailable && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                        <Globe2 className="w-4 h-4" /> {t('remote')}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl shadow-sm border-none h-fit">
                        <CardHeader><CardTitle>{t('rateCard')}</CardTitle></CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            {interpreter.rateCard.map(item => (
                                <div key={item.id} className="space-y-1 pb-4 border-b last:border-0 last:pb-0">
                                    <div className="flex justify-between gap-2">
                                        <span className="font-medium">{item.name}</span>
                                        <span className="font-semibold whitespace-nowrap">{l.rate(item.price, item.unit)}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {l.unit(item.unit)}
                                        {item.unit === 'hour' && item.minQty > 1 && ` · ${t('minHours', { hours: item.minQty })}`}
                                        {item.unit === 'page' && item.minQty > 1 && ` · ${t('minPages', { pages: item.minQty })}`}
                                        {item.unit === 'session' && ` · ${t('sessionLength', { hours: item.sessionHours })}`}
                                    </p>
                                    {item.description && <p className="text-xs text-muted-foreground whitespace-pre-line">{item.description}</p>}
                                    <Button asChild variant="link" size="sm" className="px-0 h-auto">
                                        <Link href={withLawyer(`/interpreters/${interpreter.id}/book?item=${item.id}`)}>{t('bookThis')} →</Link>
                                    </Button>
                                </div>
                            ))}
                            <p className="text-xs text-muted-foreground pt-1">{t('customQuoteHint')}</p>
                            {interpreter.schedule?.workingHours?.start && (
                                <p className="flex items-center gap-2 text-muted-foreground pt-2 border-t">
                                    <CalendarClock className="w-4 h-4" />
                                    {t('workingHours', { start: interpreter.schedule.workingHours.start, end: interpreter.schedule.workingHours.end })}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {verified && (
                    <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
                        <Info className="w-4 h-4 flex-shrink-0" /> {t('verifiedNote')}
                    </p>
                )}
            </div>
        </div>
    );
}
