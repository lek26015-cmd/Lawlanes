'use client';

/** รายการห้องแชทกับล่าม — ใช้ในแดชบอร์ดลูกค้า (as=customer) และแดชบอร์ดล่าม (as=interpreter) */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listMyInterpreterConversationsAction } from '@/app/actions/interpreter-chat-actions';
import { getCloudflareVariantUrl } from '@/lib/cloudflare-images';
import profileImg from '@/pic/profile-lawyer.jpg';
import type { InterpreterConversationSummary } from '@/lib/interpreter-types';
import { useInterpreterLabels } from './use-interpreter-labels';

export function InterpreterConversationsList({ as, card = false }: { as: 'customer' | 'interpreter'; card?: boolean }) {
    const t = useTranslations('InterpreterChat');
    const l = useInterpreterLabels();
    const [items, setItems] = useState<InterpreterConversationSummary[] | null>(null);

    useEffect(() => { listMyInterpreterConversationsAction(as).then(setItems); }, [as]);

    if (!items) return null;
    // แดชบอร์ดลูกค้า: ไม่แสดงการ์ดถ้ายังไม่เคยคุยกับล่าม
    if (card && items.length === 0) return null;

    const list = items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{t('noConversations')}</p>
    ) : (
        <div className="divide-y">
            {items.map(c => (
                <Link key={c.id} href={`/interpreter-chat/${c.id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50 rounded-lg px-2 -mx-2">
                    <div className="relative h-10 w-10 flex-shrink-0">
                        <Image src={getCloudflareVariantUrl(c.otherImageUrl, 'avatar') || profileImg} alt="" fill sizes="40px" className="rounded-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{c.otherName || t('customer')}</p>
                        <p className="text-sm text-muted-foreground truncate">{c.lastMessage}</p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                        {c.lastMessageAt && <p className="text-[11px] text-muted-foreground">{l.dateTime(c.lastMessageAt)}</p>}
                        {c.unread > 0 && <Badge className="bg-red-500">{c.unread}</Badge>}
                    </div>
                </Link>
            ))}
        </div>
    );

    if (!card) return list;
    return (
        <Card className="rounded-none md:rounded-3xl shadow-none md:shadow-sm border-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold"><MessageCircle className="w-5 h-5" /> {t('myConversations')}</CardTitle>
            </CardHeader>
            <CardContent>{list}</CardContent>
        </Card>
    );
}
