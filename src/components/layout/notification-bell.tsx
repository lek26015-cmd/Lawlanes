'use client';

import { useState, useEffect } from 'react';
import { Bell, MessageSquare, Briefcase, CreditCard, CheckCircle, Clock } from 'lucide-react';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Link } from '@/navigation';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

export default function NotificationBell() {
    const { user } = useUser();
    const { firestore } = useFirebase();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user || !firestore) return;

        const q = query(
            collection(firestore, 'notifications'),
            where('recipient', 'in', [user.uid, 'admin']),
            orderBy('createdAt', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setNotifications(notifs);
            setUnreadCount(notifs.filter((n: any) => !n.read).length);
        });

        return () => unsubscribe();
    }, [user, firestore]);

    const markAsRead = async (id: string) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'notifications', id), {
                read: true
            });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'chat_message': return <MessageSquare className="w-4 h-4 text-blue-500" />;
            case 'case_update': return <Briefcase className="w-4 h-4 text-amber-500" />;
            case 'payment': return <CreditCard className="w-4 h-4 text-green-500" />;
            default: return <Bell className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-slate-100 transition-colors">
                    <Bell className="h-5 w-5 text-slate-600" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 rounded-2xl shadow-2xl border-slate-100 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <DropdownMenuLabel className="font-bold text-slate-900 m-0 p-0 text-base">การแจ้งเตือน</DropdownMenuLabel>
                    {unreadCount > 0 && <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">ใหม่ {unreadCount}</Badge>}
                </div>
                
                <div className="max-h-[70vh] overflow-y-auto no-scrollbar">
                    {notifications.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <Bell className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">ไม่มีการแจ้งเตือนใหม่</p>
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <DropdownMenuItem 
                                key={notif.id} 
                                asChild
                                className={cn(
                                    "p-0 focus:bg-blue-50/50 cursor-pointer border-b border-slate-50 last:border-0",
                                    !notif.read && "bg-blue-50/30"
                                )}
                            >
                                <Link 
                                    href={notif.link || '#'} 
                                    className="flex items-start gap-3 p-4 w-full"
                                    onClick={() => markAsRead(notif.id)}
                                >
                                    <div className={cn(
                                        "mt-0.5 p-2 rounded-full",
                                        !notif.read ? "bg-white shadow-sm ring-1 ring-blue-100" : "bg-slate-50"
                                    )}>
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <p className={cn(
                                                "text-sm truncate pr-2 font-bold",
                                                !notif.read ? "text-slate-900" : "text-slate-600"
                                            )}>
                                                {notif.title}
                                            </p>
                                            {!notif.read && <span className="h-2 w-2 mt-1.5 rounded-full bg-blue-600 shrink-0" />}
                                        </div>
                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-1.5">
                                            {notif.message}
                                        </p>
                                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {notif.createdAt?.toDate ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true, locale: th }) : 'เมื่อสักครู่'}
                                        </p>
                                    </div>
                                </Link>
                            </DropdownMenuItem>
                        ))
                    )}
                </div>
                
                <DropdownMenuSeparator className="m-0" />
                <div className="p-2 bg-slate-50 text-center">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-blue-600 font-bold hover:bg-white hover:text-blue-700" asChild>
                        <Link href="/dashboard">ดูทั้งหมดในแดชบอร์ด</Link>
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
