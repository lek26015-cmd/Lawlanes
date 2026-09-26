'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BadgeCheck, Globe2, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getCloudflareVariantUrl } from '@/lib/cloudflare-images';
import profileImg from '@/pic/profile-lawyer.jpg';
import type { PublicInterpreter } from '@/lib/interpreter-types';
import { cheapestRate } from '@/lib/interpreter-pricing';
import { useInterpreterLabels } from './use-interpreter-labels';

export function InterpreterCard({ interpreter, query }: { interpreter: PublicInterpreter; query?: string }) {
    const t = useTranslations('Interpreters');
    const l = useInterpreterLabels();
    const href = `/interpreters/${interpreter.id}${query ? `?${query}` : ''}`;
    const cheapest = cheapestRate(interpreter.rateCard);

    return (
        <Card className="rounded-2xl border-none shadow-sm hover:shadow-md transition-shadow h-full">
            <CardContent className="p-5 flex flex-col h-full gap-4">
                <div className="flex items-start gap-4">
                    <div className="relative h-16 w-16 flex-shrink-0">
                        <Image
                            src={getCloudflareVariantUrl(interpreter.imageUrl, 'avatar') || profileImg}
                            alt={interpreter.name}
                            fill
                            sizes="64px"
                            className="rounded-full object-cover"
                        />
                    </div>
                    <div className="min-w-0">
                        <Link href={href} className="font-bold text-lg text-[#0B3979] hover:underline line-clamp-1">
                            {interpreter.name}
                        </Link>
                        {interpreter.verifiedCredentials.length > 0 && (
                            <p className="flex items-center gap-1 text-xs text-emerald-700 mt-0.5">
                                <BadgeCheck className="w-3.5 h-3.5" /> {t('verifiedBadge')}
                            </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                            {interpreter.languages.map(lang => (
                                <Badge key={lang.code} variant="secondary" className="text-xs">{l.language(lang.code)}</Badge>
                            ))}
                        </div>
                    </div>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-3">{l.description(interpreter)}</p>

                <div className="text-sm space-y-1 mt-auto">
                    {cheapest && (
                        <p className="font-semibold text-slate-800">
                            {t('startingFrom', { price: l.rate(cheapest.price, cheapest.unit) })}
                            {interpreter.rateCard.length > 1 && (
                                <span className="font-normal text-muted-foreground"> · {t('rateCount', { count: interpreter.rateCard.length })}</span>
                            )}
                        </p>
                    )}
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {interpreter.serviceProvinces.length > 0 && (
                            <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {interpreter.serviceProvinces.slice(0, 2).join(', ')}
                                {interpreter.serviceProvinces.length > 2 ? ` +${interpreter.serviceProvinces.length - 2}` : ''}
                            </span>
                        )}
                        {interpreter.remoteAvailable && (
                            <span className="flex items-center gap-1"><Globe2 className="w-3.5 h-3.5" /> {t('remote')}</span>
                        )}
                    </p>
                </div>

                <Button asChild className="w-full bg-[#0B3979] hover:bg-[#0B3979]/90">
                    <Link href={href}>{t('viewProfile')}</Link>
                </Button>
            </CardContent>
        </Card>
    );
}
