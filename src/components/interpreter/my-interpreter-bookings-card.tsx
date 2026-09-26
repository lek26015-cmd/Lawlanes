'use client';

/** การ์ด "งานล่ามของฉัน" ในแดชบอร์ดลูกค้า — ไม่แสดงอะไรถ้ายังไม่เคยจอง */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Languages, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cancelInterpreterBookingAction, getMyInterpreterBookingsAction } from '@/app/actions/interpreter-booking-actions';
import { SLOT_HOLDING_STATUSES, type InterpreterBookingView } from '@/lib/interpreter-types';
import { useInterpreterLabels } from './use-interpreter-labels';

export function MyInterpreterBookingsCard() {
    const t = useTranslations('Interpreters.my');
    const tBook = useTranslations('Interpreters.book');
    const l = useInterpreterLabels();
    const { toast } = useToast();
    const [bookings, setBookings] = useState<InterpreterBookingView[] | null>(null);
    const [cancelling, setCancelling] = useState<string | null>(null);

    const load = useCallback(() => { getMyInterpreterBookingsAction().then(setBookings); }, []);
    useEffect(load, [load]);

    if (!bookings || bookings.length === 0) return null;

    const cancel = async (id: string) => {
        if (!window.confirm(t('cancelConfirm'))) return;
        setCancelling(id);
        const res = await cancelInterpreterBookingAction(id);
        setCancelling(null);
        if (!res.ok) return toast({ variant: 'destructive', title: res.error });
        load();
    };

    return (
        <Card className="rounded-none md:rounded-3xl shadow-none md:shadow-sm border-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 font-bold">
                    <Languages className="w-5 h-5" /> {t('title')}
                </CardTitle>
                <Button asChild variant="ghost" size="sm"><Link href="/interpreters">{t('findInterpreter')}</Link></Button>
            </CardHeader>
            <CardContent className="divide-y">
                {bookings.map(b => (
                    <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="font-medium">{b.interpreterName} · {b.quote.itemName || l.service(b.serviceType)}</p>
                            <p className="text-sm text-muted-foreground">
                                {l.language(b.languagePair.from)} → {l.language(b.languagePair.to)} ·{' '}
                                {b.startAt
                                    ? `${l.dateTime(b.startAt)} (${b.days ? tBook('daysUnit', { days: b.days }) : tBook('hoursUnit', { hours: b.durationHours ?? 0 })})`
                                    : b.pageCount ? t('pages', { count: b.pageCount }) : l.service(b.serviceType)}
                                {' · '}฿{l.satang(b.quote.grossAmount)}
                            </p>
                            {b.contact && (
                                <p className="text-sm text-emerald-800">
                                    {t('contactLine', { phone: b.contact.phone || '—', line: b.contact.lineId || '—' })}
                                </p>
                            )}
                            <Link href={`/interpreter-chat/${b.conversationId}`} className="text-sm text-[#0B3979] hover:underline">{t('openChat')}</Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary">{l.status(b.status)}</Badge>
                            {SLOT_HOLDING_STATUSES.includes(b.status) && (
                                <Button variant="ghost" size="sm" disabled={cancelling === b.id} onClick={() => cancel(b.id)}>
                                    {cancelling === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t('cancel')}
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
