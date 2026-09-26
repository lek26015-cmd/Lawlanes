'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Search, Inbox, Circle } from 'lucide-react';
import { Link } from '@/navigation';
import { useUser, useFirebase } from '@/firebase';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getLawyerDashboardData } from '@/lib/data';
import type { LawyerCase } from '@/lib/types';
import LawyerPageHeader, { LawyerPageLoading } from '@/components/lawyer/lawyer-page-header';

// กล่องแชทรวมของทนาย — เดิมไม่มีเมนูแชท ต้องเข้าผ่าน "เคสที่กำลังดำเนินการ" ในหน้าภาพรวมเท่านั้น
export default function LawyerChatsPage() {
    const { user, isUserLoading } = useUser();
    const { firestore } = useFirebase();
    const [active, setActive] = useState<LawyerCase[]>([]);
    const [closed, setClosed] = useState<LawyerCase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [tab, setTab] = useState<'active' | 'closed'>('active');
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (isUserLoading || !user || !firestore) return;
        // ใช้แหล่งเดียวกับหน้าภาพรวม ตัวเลขจะได้ตรงกัน
        getLawyerDashboardData(firestore, user.uid)
            .then(({ activeCases, completedCases }) => {
                setActive(activeCases);
                setClosed(completedCases);
            })
            .catch((e) => console.error('Error loading lawyer chats:', e))
            .finally(() => setIsLoading(false));
    }, [isUserLoading, user, firestore]);

    const list = useMemo(() => {
        const q = query.trim().toLowerCase();
        const src = tab === 'active' ? active : closed;
        return q ? src.filter(c => `${c.clientName} ${c.title} ${c.lastMessage ?? ''}`.toLowerCase().includes(q)) : src;
    }, [tab, active, closed, query]);

    if (isUserLoading || isLoading || !user) return <LawyerPageLoading />;

    const unread = active.filter(c => c.notifications).length;

    return (
        <>
            <LawyerPageHeader
                icon={MessageSquare}
                title="แชทกับลูกความ"
                description={unread > 0 ? `มีข้อความใหม่ ${unread} ห้อง` : 'ห้องแชททั้งหมดกับลูกความของคุณ'}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Tabs value={tab} onValueChange={(v) => setTab(v as 'active' | 'closed')}>
                    <TabsList className="rounded-xl">
                        <TabsTrigger value="active" className="rounded-lg">กำลังคุย ({active.length})</TabsTrigger>
                        <TabsTrigger value="closed" className="rounded-lg">ปิดแล้ว ({closed.length})</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="relative sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาชื่อลูกความหรือเรื่อง" className="pl-9 rounded-xl bg-white dark:bg-card" />
                </div>
            </div>

            <Card className="rounded-2xl border shadow-sm divide-y overflow-hidden">
                {list.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground">
                        <Inbox className="mx-auto h-8 w-8 mb-2 opacity-40" />
                        <p className="text-sm">{query ? 'ไม่พบห้องแชทที่ค้นหา' : tab === 'active' ? 'ยังไม่มีห้องแชทที่กำลังคุย' : 'ยังไม่มีห้องแชทที่ปิดแล้ว'}</p>
                    </div>
                ) : (
                    list.map(c => (
                        <Link
                            key={c.id}
                            href={`/chat/${c.id}?lawyerId=${user.uid}&clientId=${c.clientId}&view=lawyer`}
                            className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                        >
                            <div className="relative shrink-0">
                                {c.clientImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={c.clientImageUrl} alt="" className="w-11 h-11 rounded-full object-cover bg-slate-100" />
                                ) : (
                                    <div className="w-11 h-11 rounded-full bg-[#002f4b]/10 text-[#002f4b] dark:text-blue-300 flex items-center justify-center font-bold">
                                        {c.clientName.slice(0, 1)}
                                    </div>
                                )}
                                {c.isOnline && <Circle className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 fill-emerald-500 text-white" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <p className={`truncate text-sm ${c.notifications ? 'font-bold text-foreground' : 'font-semibold text-foreground'}`}>{c.clientName}</p>
                                    <span className="shrink-0 text-xs text-muted-foreground">{c.lastUpdate}</span>
                                </div>
                                <p className="truncate text-xs text-muted-foreground">{c.title}</p>
                                {c.lastMessage && (
                                    <p className={`truncate text-sm mt-0.5 ${c.notifications ? 'text-foreground' : 'text-muted-foreground'}`}>
                                        {c.lastMessage.startsWith('[E2EE') ? 'ข้อความเข้ารหัส' : c.lastMessage}
                                    </p>
                                )}
                            </div>
                            {!!c.notifications && <Badge className="shrink-0 bg-[#002f4b] hover:bg-[#002f4b]">ใหม่</Badge>}
                        </Link>
                    ))
                )}
            </Card>
        </>
    );
}
