'use client';

import { useState, useEffect } from 'react';
import { Bell, MessageSquare, Briefcase, CreditCard, CheckCircle, Clock, FileIcon, ImageIcon, Maximize2, ExternalLink, Eye } from 'lucide-react';
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
import { getSecureDownloadUrl } from '@/app/actions/secure-view';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';

export default function NotificationBell({ isAdmin = false }: { isAdmin?: boolean }) {
    const { user } = useUser();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [previewFile, setPreviewFile] = useState<{ url: string, name: string, isImage: boolean } | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [lastNotifId, setLastNotifId] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !firestore) return;

        const recipients = isAdmin ? [user.uid, 'admin'] : [user.uid];

        const q = query(
            collection(firestore, 'notifications'),
            where('recipient', 'in', recipients),
            orderBy('createdAt', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Detection logic for new notifications (toast)
            if (notifs.length > 0) {
                const latest = notifs[0];
                if (lastNotifId && latest.id !== lastNotifId && !latest.read) {
                    // This is a new notification
                    const isFileUpload = latest.type === 'file_upload';
                    toast({
                        title: latest.title,
                        description: latest.message,
                        action: isFileUpload ? (
                            <Button 
                                size="sm" 
                                variant="default" 
                                className="rounded-full h-8 px-3 bg-purple-600 hover:bg-purple-700 text-white" 
                                onClick={(e) => handleViewFile(latest, e)}
                            >
                                ดูเอกสาร
                            </Button>
                        ) : (
                            <Button size="sm" variant="outline" className="rounded-full h-8 px-3" asChild>
                                <Link href={latest.link || '#'}>ดูเลย</Link>
                            </Button>
                        )
                    });
                }
                setLastNotifId(latest.id);
            }

            setNotifications(notifs);
            setUnreadCount(notifs.filter((n: any) => !n.read).length);
        });

        return () => unsubscribe();
    }, [user, firestore, lastNotifId, isAdmin]);

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

    const handleViewFile = async (notif: any, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const metadata = notif.metadata;
        if (!metadata || !metadata.fileUrl) return;

        try {
            const url = await getSecureDownloadUrl(metadata.fileUrl);
            if (!url) return;

            if (metadata.isImage) {
                setPreviewFile({ url, name: metadata.fileName, isImage: true });
                setIsPreviewOpen(true);
            } else {
                window.open(url, '_blank');
            }
            
            // Mark as read if it wasn't
            if (!notif.read) markAsRead(notif.id);
        } catch (err) {
            console.error("Failed to view file from notification:", err);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'chat_message': return <MessageSquare className="w-4 h-4 text-blue-500" />;
            case 'file_upload': return <FileIcon className="w-4 h-4 text-purple-500" />;
            case 'case_update': return <Briefcase className="w-4 h-4 text-amber-500" />;
            case 'payment': return <CreditCard className="w-4 h-4 text-green-500" />;
            default: return <Bell className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <>
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
                    <div className="flex items-center gap-2">
                        <DropdownMenuLabel className="font-bold text-slate-900 m-0 p-0 text-base">การแจ้งเตือน</DropdownMenuLabel>
                        {unreadCount > 0 && <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">ใหม่ {unreadCount}</Badge>}
                    </div>
                    {unreadCount > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                markAllAsRead(firestore, notifications);
                            }}
                        >
                            อ่านทั้งหมด
                        </Button>
                    )}
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
                                <div className="relative group">
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
                                            
                                            <div className="flex items-center justify-between mt-1">
                                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {notif.createdAt?.toDate ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true, locale: th }) : 'เมื่อสักครู่'}
                                                </p>
                                                
                                                {notif.type === 'file_upload' && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="secondary" 
                                                        className="h-6 px-2 text-[10px] font-bold bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-100 rounded-lg flex items-center gap-1"
                                                        onClick={(e) => handleViewFile(notif, e)}
                                                    >
                                                        <Eye className="w-3 h-3" /> ดูเอกสาร
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                </div>
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

        {/* Image Preview Modal */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-4xl w-[95vw] h-[80vh] flex flex-col p-0 overflow-hidden border-none rounded-3xl z-[150]">
                <DialogHeader className="p-4 border-b bg-white flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <ImageIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-sm font-bold truncate max-w-[200px] md:max-w-md">{previewFile?.name}</DialogTitle>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">ตัวอย่างรูปภาพ</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pr-8">
                        <Button size="sm" variant="outline" className="rounded-full text-xs h-8" onClick={() => window.open(previewFile?.url, '_blank')}>
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> เปิดเต็มจอ
                        </Button>
                    </div>
                </DialogHeader>
                <div className="flex-1 bg-slate-900 flex items-center justify-center overflow-hidden">
                    {previewFile?.url && (
                        <img 
                            src={previewFile.url} 
                            alt={previewFile.name} 
                            className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300"
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}

const markAllAsRead = async (firestore: any, notifications: any[]) => {
    if (!firestore || notifications.length === 0) return;
    try {
        const { writeBatch, doc } = await import('firebase/firestore');
        const batch = writeBatch(firestore);
        let unreadExist = false;
        
        notifications.forEach(notif => {
            if (!notif.read) {
                batch.update(doc(firestore, 'notifications', notif.id), { read: true });
                unreadExist = true;
            }
        });

        if (unreadExist) {
            await batch.commit();
        }
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
    }
};
