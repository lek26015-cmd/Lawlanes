'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getLawyerById } from '@/lib/data';
import type { LawyerProfile } from '@/lib/types';
import { useFirebase, useUser } from '@/firebase';
import { ChatBox } from '@/components/chat/chat-box';
import { uploadFileAction } from '../actions';
import { requestFeeAction, getChatDetailsAction, ensureChatExistsAction } from '@/app/actions/chat-actions';
import { submitReviewAction } from '@/app/actions/review-actions';
import { getCaseMilestones, toggleMilestoneStatusAction, addCaseMilestoneAction } from '@/app/actions/lawyer-case-actions';
import type { Milestone } from '@/lib/types/billing-types';
import { useTranslations } from 'next-intl';
import { getSecureDownloadUrl } from '@/app/actions/secure-view';
import { CaseRoadmap } from '@/components/case/case-roadmap';
import { LegalResearchTool } from '@/components/case/legal-research-tool';
import { cn } from '@/lib/utils';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText, Check, Upload, Scale, Ticket, Briefcase, User as UserIcon, DollarSign, ArrowLeft, Plus, Sparkles, BrainCircuit, Globe, ArrowRight, CheckCircle2, Loader2, Image as ImageIcon, Trash2, ShieldAlert, ExternalLink, ScrollText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { CopyButton } from '@/components/ui/copy-button';
import { Link } from '@/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { doc, getDoc, updateDoc, arrayUnion, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/constants';

function ChatPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const chatId = params.id as string;
    const lawyerId = searchParams.get('lawyerId');
    const clientId = searchParams.get('clientId');
    const view = searchParams.get('view');

    const [lawyer, setLawyer] = useState<LawyerProfile | null>(null);
    const [client, setClient] = useState<{ id: string, name: string, imageUrl: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [files, setFiles] = useState<{ name: string, url: string, size: number }[]>([]);
    const [chatStatus, setChatStatus] = useState<string>(searchParams.get('status') || 'active');
    const [chatAmount, setChatAmount] = useState<number>(0);
    const [isManualCase, setIsManualCase] = useState<boolean>(false);
    const [installments, setInstallments] = useState<any[]>([]);
    const [caseTitle, setCaseTitle] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [pendingFeeRequest, setPendingFeeRequest] = useState<{ amount: number, reason: string } | null>(null);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isAdminView, setIsAdminView] = useState(false);
    const [accessError, setAccessError] = useState<string | null>(null);
    const { toast } = useToast();

    const tCase = useTranslations('CaseRoom');
    const tCommon = useTranslations('Dashboard');

    const isCompleted = chatStatus === 'closed';
    const [effectiveIsLawyerView, setEffectiveIsLawyerView] = useState(view === 'lawyer');
    const [isUserLawyer, setIsUserLawyer] = useState(false);
    const [isChatDisabled, setIsChatDisabled] = useState(isCompleted);
    const [previewFile, setPreviewFile] = useState<{ url: string, name: string } | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const [clientInfo, setClientInfo] = useState<{ name: string, address: string, taxId: string } | null>(null);
    const isOfficial = chatAmount > 0;

    // Compute milestoneSteps and currentStep from real milestones
    const milestoneSteps = milestones.length > 0 ? milestones.map((m, idx) => ({
      id: idx + 1,
      label: m.title,
      icon: m.status === 'completed' ? CheckCircle2 : FileText,
      date: m.status === 'completed' ? '✓ เสร็จสิ้น' : undefined,
    })) : undefined;

    const currentStep = isCompleted 
      ? (milestones.length > 0 ? milestones.length : 5) 
      : milestones.length > 0 
        ? milestones.filter(m => m.status === 'completed').length + 1
        : (isOfficial ? 4 : (pendingFeeRequest ? 2 : 1));

    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [showContractModal, setShowContractModal] = useState(false);
    const [contractText, setContractText] = useState<string | null>(null);

    const { firestore, storage } = useFirebase();
    const { user } = useUser();

    useEffect(() => {
        if (!firestore || !chatId || !user) return;

        const chatRef = doc(firestore, 'chats', chatId);
        const unsubscribe = onSnapshot(chatRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setChatStatus(data.status || 'active');
                setIsChatDisabled(data.status === 'closed');
                if (data.files) setFiles(data.files);
                if (data.amount !== undefined) setChatAmount(data.amount);
                setIsManualCase(data.isManualCase || false);
                setInstallments(data.installments || []);
                setCaseTitle(data.caseTitle || '');
                setDescription(data.description || '');
                setPendingFeeRequest(data.pendingFeeRequest || null);
                setContractText(data.contractText || null);
                setClientInfo(data.clientInfo || null);
            }
        });

        return () => unsubscribe();
    }, [firestore, chatId, user]);

    // Fetch milestones when case is official
    useEffect(() => {
        if (!isOfficial || !chatId) return;
        getCaseMilestones(chatId).then(ms => {
            if (ms && ms.length > 0) setMilestones(ms);
        }).catch(err => console.error('Milestones fetch error:', err));
    }, [isOfficial, chatId]);

    useEffect(() => {
        if (!firestore) return;

        // Sanitize IDs - common mistake to have "undefined" or "null" as string
        const sanitizeId = (id: string | null) => (id === 'undefined' || id === 'null') ? null : id;
        const sanitizedLawyerId = sanitizeId(lawyerId);
        const sanitizedClientId = sanitizeId(clientId);

        async function fetchData() {
            setIsLoading(true);
            try {
                let currentLawyerId = sanitizedLawyerId;
                let currentClientId = sanitizedClientId;
                let chatData: any = null;
                
                // 1. Fetch chat document via SERVER ACTION to bypass permission issues
                const response = await getChatDetailsAction(chatId);
                
                if (response && response.success && response.data) {
                    chatData = response.data;
                    setIsAdminView(response.isRequesterAdmin || false);
                    // Try to find missing IDs in chat document if URL params are missing/broken
                    if (!currentLawyerId) currentLawyerId = chatData.lawyerId;
                    if (!currentClientId) currentClientId = chatData.clientId || chatData.userId;
                    
                    // If STILL missing, search in participants
                    if (chatData.participants && Array.isArray(chatData.participants)) {
                        if (!currentLawyerId) {
                            // If user is lawyer, currentLawyerId is user.uid
                            const isUserLawyer = chatData.lawyerId === user?.uid || (view === 'lawyer');
                            currentLawyerId = isUserLawyer ? user?.uid : chatData.participants.find((p: string) => p !== chatData.userId && p !== chatData.clientId);
                        }
                        if (!currentClientId) {
                            currentClientId = chatData.participants.find((p: string) => p !== currentLawyerId);
                        }
                    }

                    // Sync/Repair participants if needed
                    if (currentLawyerId && currentClientId) {
                        const repairResult = await ensureChatExistsAction(chatId, [currentLawyerId, currentClientId], chatData.caseTitle || 'คดี: มรดก');
                        if (!repairResult || !repairResult.success) {
                            console.warn("D1/Worker sync repair failed:", repairResult?.error);
                        }
                    }
                } else if (response && !response.success) {
                    console.error("Chat details fetch failed:", response.error);
                    if (response.error === 'Unauthorized access.') {
                        setAccessError('คุณไม่มีสิทธิ์เข้าถึงห้องแชทนี้');
                    }
                }

                // 2. Fetch Profiles
                let fetchedLawyer: LawyerProfile | null = null;
                if (currentLawyerId) {
                    fetchedLawyer = await getLawyerById(firestore!, currentLawyerId) || null;
                    setLawyer(fetchedLawyer);
                }
                
                if (currentClientId) {
                    const clientRef = doc(firestore!, 'users', currentClientId);
                    const userDocSnap = await getDoc(clientRef);
                    
                    let resolvedName = 'ลูกความ';
                    let resolvedAvatar = '';

                    if (userDocSnap.exists()) {
                        const userData = userDocSnap.data();
                        resolvedName = userData.name || 'ลูกความ';
                        resolvedAvatar = userData.avatar || '';
                    }

                    // RECOVERY: If Firestore name is generic or missing, prioritize the name from Server Action (Auth)
                    if (resolvedName === 'ลูกความ' || !resolvedName) {
                        if (chatData?.clientName && chatData.clientName !== 'ลูกความ') {
                            resolvedName = chatData.clientName;
                        }
                    }
                    
                    // If current user is the client, they can also contribute their own name
                    if (user?.uid === currentClientId && (resolvedName === 'ลูกความ' || !resolvedName)) {
                        resolvedName = user.displayName || user.email?.split('@')[0] || 'ลูกความ';
                        
                        // AUTO-REPAIR: Create/Fix the missing profile document
                        import('firebase/firestore').then(({ setDoc, serverTimestamp }) => {
                            setDoc(clientRef, {
                                uid: user.uid,
                                name: resolvedName,
                                email: user.email,
                                role: 'customer',
                                status: 'active',
                                createdAt: serverTimestamp()
                            }, { merge: true }).catch(e => console.error("Auto-repair profile failed:", e));
                        });
                    }
                    
                    setClient({ id: currentClientId, name: resolvedName, imageUrl: resolvedAvatar });
                }

                const currentUserIsLawyer = !!((fetchedLawyer?.userId === user?.uid) || 
                                   (currentLawyerId === user?.uid) || 
                                   (chatData?.lawyerId === user?.uid));
                setIsUserLawyer(currentUserIsLawyer);
                
                const currentIsLawyerView = !!(currentUserIsLawyer || (response?.isRequesterAdmin && view === 'lawyer'));
                setEffectiveIsLawyerView(currentIsLawyerView);
            } catch (err) {
                console.error("Error in ChatPage fetchData:", err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [lawyerId, clientId, firestore, chatId, user, view]);

    const handleUploadClick = () => fileInputRef.current?.click();

    const executeFileUpload = async (file: File) => {
        if (!file || !user || !storage || !firestore) return;

        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast({ variant: "destructive", title: "ไฟล์มีขนาดใหญ่เกินไป", description: `ไม่เกิน ${MAX_FILE_SIZE_MB}MB` });
            return;
        }

        if (isUploading) {
            toast({ title: "กรุณารอสักครู่", description: "กำลังมีการอัปโหลดไฟล์อื่นอยู่" });
            return;
        }

        try {
            setIsUploading(true);
            toast({ title: "กำลังอัปโหลด...", description: "กรุณารอสักครู่" });
            const idToken = await user.getIdToken();
            const formData = new FormData();
            formData.append('file', file);

            const result = await uploadFileAction(formData, idToken, chatId);
            const fileData = {
                name: file.name,
                url: result.fullPath,
                size: file.size,
                uploadedBy: user.uid,
                uploadedAt: Date.now()
            };

            await updateDoc(doc(firestore, 'chats', chatId), {
                files: arrayUnion(fileData)
            });

            // 10. NOTIFY counterpart about the new document
            try {
                const authToken = await user.getIdToken();
                const { sendChatMessageAction } = await import('@/app/actions/chat-actions');
                const notifyResult = await sendChatMessageAction({
                    chatId,
                    text: `[อัปโหลดไฟล์] ${file.name}`,
                    senderId: user.uid,
                    senderName: effectiveIsLawyerView ? (user.displayName || 'ทนายความ') : (user.displayName || 'ลูกความ'),
                    recipientId: otherUser.userId,
                    isLawyerView: effectiveIsLawyerView,
                    authToken,
                    metadata: {
                        type: 'file_upload',
                        fileName: file.name,
                        fileUrl: result.fullPath,
                        isImage: /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
                    }
                });

                if (notifyResult && !notifyResult.success) {
                    console.error("Upload notification failed:", notifyResult.error);
                }
            } catch (notifyErr) {
                console.warn("Upload notification failed (exception):", notifyErr);
            }

            toast({ title: "อัปโหลดไฟล์สำเร็จ", description: `ไฟล์ "${file.name}" ถูกเพิ่มแล้ว` });
        } catch (error: any) {
            toast({ variant: "destructive", title: "อัปโหลดไม่สำเร็จ", description: error.message });
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) await executeFileUpload(file);
        if (event.target) event.target.value = '';
    };

    const handleViewFile = async (path: string, fileName?: string) => {
        if (!path) return;
        
        const isImage = fileName ? /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName) : false;

        if (path.startsWith('http')) {
            if (isImage) {
                setPreviewFile({ url: path, name: fileName || 'Image' });
                setIsPreviewOpen(true);
            } else {
                window.open(path, '_blank');
            }
            return;
        }

        try {
            const url = await getSecureDownloadUrl(path, chatId);
            if (url) {
                if (isImage) {
                    setPreviewFile({ url, name: fileName || 'Image' });
                    setIsPreviewOpen(true);
                } else {
                    window.open(url, '_blank');
                }
            } else {
                toast({ variant: "destructive", title: "ไม่สามารถเข้าถึงไฟล์ได้", description: "กรุณาลองใหม่อีกครั้ง" });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
        }
    };

    const handleConfirmRelease = async () => {
        if (!firestore) return;
        if (!effectiveIsLawyerView) {
            toast({ variant: "destructive", title: "ไม่มีสิทธิ์", description: "เฉพาะทนายความเท่านั้นที่สามารถปิดเคสได้" });
            return;
        }
        try {
            await updateDoc(doc(firestore, 'chats', chatId), {
                status: 'closed',
                closedAt: serverTimestamp()
            });
            toast({ title: "ดำเนินการสำเร็จ", description: "เคสเสร็จสมบูรณ์แล้ว" });
            setTimeout(() => {
                if (lawyerId) {
                    router.push(`/review/${chatId}?lawyerId=${lawyerId}`);
                } else {
                    toast({ variant: "destructive", title: "ข้อผิดพลาด", description: "ไม่พบรหัสประจำตัวทนายความ ไม่สามารถส่งไปยังหน้ารีวิวได้" });
                    router.push('/dashboard');
                }
            }, 1500);
        } catch (error) {
            toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: "ไม่สามารถปิดเคสได้" });
        }
    };

    const handleSubmitReview = async () => {
        if (rating === 0) {
            toast({ variant: "destructive", title: "ข้อผิดพลาด", description: "กรุณาให้คะแนนก่อนส่งรีวิว" });
            return;
        }
        if (!user || !lawyerId) {
            toast({ variant: "destructive", title: "ข้อผิดพลาด", description: "ไม่พบข้อมูลทนายความในระบบ" });
            return;
        }
        try {
            setIsLoading(true);
            await submitReviewAction({
                lawyerId,
                userId: user.uid,
                author: client?.name || user.displayName || 'Anonymous',
                avatar: client?.imageUrl || user.photoURL || '',
                rating: Number(rating),
                comment: reviewText,
                caseId: chatId
            });
            toast({ title: "ส่งรีวิวสำเร็จ" });
            router.push('/dashboard');
        } catch (error: any) {
            toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleMilestone = async (milestoneId: string) => {
        if (!effectiveIsLawyerView) return;
        try {
            const res = await toggleMilestoneStatusAction(milestoneId, chatId);
            if (res.success) {
                setMilestones(prev => prev.map(m => m.id === milestoneId ? { ...m, status: res.newStatus } as Milestone : m));
                toast({ title: 'อัปเดตสถานะสำเร็จ' });
            } else {
                toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: res.error || 'Unknown error' });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: e.message });
        }
    };

    const handleInitializeDefaultMilestones = async () => {
        if (!effectiveIsLawyerView) return;
        setIsLoading(true);
        try {
            const defaultTitles = ['วิเคราะห์รูปคดี', 'จัดเตรียมเอกสาร', 'ยื่นคำฟ้อง', 'ตรวจพยานหลักฐาน', 'นัดสืบพยาน'];
            for (const title of defaultTitles) {
                await addCaseMilestoneAction(chatId, title);
            }
            const ms = await getCaseMilestones(chatId);
            setMilestones(ms || []);
            toast({ title: 'สร้างแผนคดีมาตรฐานสำเร็จ' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: e.message });
        } finally {
            setIsLoading(false);
        }
    };


    if (isLoading) return <div className="flex h-screen items-center justify-center">Loading chat...</div>;

    if (accessError) {
        return (
            <div className="flex flex-col h-screen items-center justify-center p-4 text-center">
                <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
                <h2 className="text-xl font-bold mb-2">{accessError}</h2>
                <p className="text-slate-500 mb-6">ขออภัย คุณไม่ได้รับอนุญาตให้เข้าถึงข้อมูลในส่วนนี้</p>
                <Button asChild rounded-xl>
                    <Link href="/dashboard">กลับสู่หน้าหลัก</Link>
                </Button>
            </div>
        );
    }

    const chatPartner = effectiveIsLawyerView ? client : lawyer;
    if (!chatPartner || !user || !firestore) {
        if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin" /> กำลังโหลดข้อมูล...</div>;
        return <div>Unable to load chat. Missing information (Partner: {chatPartner ? 'OK' : 'MISSING'}).</div>;
    }

    const otherUser = {
        name: effectiveIsLawyerView ? (client?.name || 'ลูกความ') : (lawyer?.name || 'ทนายความ'),
        userId: effectiveIsLawyerView ? (client?.id || '') : (lawyer?.userId || lawyer?.id || ''),
        imageUrl: getCloudflareVariantUrl(effectiveIsLawyerView ? (client?.imageUrl || "") : (lawyer?.imageUrl || ""), 'avatar'),
    };
    
    // Fallback lawyer ID for payment routes when missing from URL param
    const resolvedLawyerId = lawyerId || (effectiveIsLawyerView ? user.uid : otherUser.userId) || '';

    const renderOperationsPanel = () => (
        <div className="space-y-6">
            {isOfficial && (
                <div className="w-full bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-2 shadow-sm animate-in fade-in zoom-in-95 duration-500">
                    <CaseRoadmap currentStep={currentStep} className="pt-4 pb-8" isPremium={isOfficial} steps={milestoneSteps} />
                </div>
            )}
            
            <Tabs defaultValue="info" className="w-full">
                <TabsList className="w-full bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm p-1.5 rounded-2xl h-auto flex flex-wrap lg:flex-nowrap gap-1 border border-slate-200/50 dark:border-slate-700/50">
                    <TabsTrigger value="overview" className="min-w-0 px-2 flex-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest py-2 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md transition-all duration-300">
                        <span className="truncate">Overview</span>
                    </TabsTrigger>
                    <TabsTrigger value="info" className="min-w-0 px-2 flex-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest py-2 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md transition-all duration-300">
                        <span className="truncate">{tCommon('viewDetails')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="vault" className="min-w-0 px-2 flex-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest py-2 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md transition-all duration-300">
                        <span className="truncate">{tCase('legalVault').split(' ')[0]}</span>
                    </TabsTrigger>

                </TabsList>
                
                <TabsContent value="info" className="space-y-6">
                    {effectiveIsLawyerView ? (
                        <Card className="border-none shadow-sm bg-slate-50 dark:bg-slate-900/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-primary" />
                                    ขอบเขตเคส
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={getCloudflareVariantUrl(otherUser.imageUrl, 'avatar')} />
                                        <AvatarFallback>{otherUser.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">ลูกความ</p>
                                        <p className="font-bold text-slate-900 dark:text-white leading-tight">{otherUser.name}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-xs text-slate-500 font-medium">Ticket ID:</span>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono truncate">{chatId}</code>
                                        <CopyButton value={chatId} className="h-6 w-6" />
                                    </div>
                                </div>
                                <div className="flex justify-between px-1">
                                    <span className="text-xs text-slate-500 font-medium">สถานะ:</span>
                                    <Badge variant={isCompleted ? "secondary" : (chatStatus === 'pending_payment' ? "destructive" : "default")} className="text-[10px] px-1.5 py-0">
                                        {isCompleted ? 'เสร็จสิ้น' : (chatStatus === 'pending_payment' ? "รอชำระเงิน" : 'กำลังดำเนินการ')}
                                    </Badge>
                                </div>
                                <div className="flex justify-between px-1">
                                    <span className="text-xs text-slate-500 font-medium">ค่าบริการ:</span>
                                    <span className="font-bold text-slate-900 dark:text-white">฿{chatAmount.toLocaleString()}</span>
                                </div>
                                
                                {(caseTitle || description) && (
                                    <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                                        {caseTitle && (
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-medium mb-1">หัวข้อคดี/บริการ</p>
                                                <p className="text-xs font-bold text-slate-900 dark:text-white">{caseTitle}</p>
                                            </div>
                                        )}
                                        {description && (
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-medium mb-1">รายละเอียดขอบเขตงาน (Scope of Work)</p>
                                                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{description || "-"}</p>
                                                </div>
                                            </div>
                                        )}
                                        {installments && installments.length > 0 && (
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-medium mb-1">แผนการชำระเงิน (Installments)</p>
                                                <div className="space-y-1.5">
                                                    {installments.map((inst: any, idx: number) => {
                                                        const instAmount = inst.amount && !isNaN(parseFloat(inst.amount)) ? parseFloat(String(inst.amount).replace(/,/g, '')) : 0;
                                                        return (
                                                            <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-xs shadow-sm">
                                                                <span className="font-medium text-slate-700 dark:text-slate-300">งวดที่ {idx + 1}: {inst.description}</span>
                                                                <span className="font-black text-blue-600 dark:text-blue-400 whitespace-nowrap ml-2">฿{instAmount.toLocaleString()}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="flex-col gap-2 pt-2">
                                {!isCompleted && (
                                    <>
                                        <Button 
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-xs h-10 font-bold rounded-2xl shadow-lg shadow-blue-500/20" 
                                            disabled={isUploading}
                                            onClick={() => router.push(`/lawyer-dashboard/pipeline/new?chatId=${chatId}&clientId=${clientId || client?.id}`)}
                                        >
                                            <Plus className="w-4 h-4 mr-2" /> เสนอราคาเปิดคดี
                                        </Button>
                                        
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" className="w-full h-9 text-xs text-slate-500 hover:text-slate-900">
                                                    ปิดสรุปเคส
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
                                                        <FileText className="w-5 h-5 text-slate-400" /> ยืนยันการปิดคดี
                                                    </AlertDialogTitle>
                                                    <AlertDialogDescription className="text-base py-2">
                                                        การปิดสรุปเคสหมายถึงคุณได้ให้คำปรึกษาเสร็จสิ้นแล้ว และจะไม่มีการเปิดเคสเป็นทางการต่อ คุณต้องการดำเนินการต่อใช่หรือไม่?
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="gap-2">
                                                    <AlertDialogCancel className="rounded-full border-slate-200">ยกเลิก</AlertDialogCancel>
                                                    <AlertDialogAction 
                                                        onClick={handleConfirmRelease}
                                                        className="bg-slate-900 hover:bg-black text-white rounded-full font-bold"
                                                    >
                                                        ยืนยันปิดคดี
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </>
                                )}
                            </CardFooter>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {(caseTitle || description || chatAmount > 0) && (
                                <Card className="border-none shadow-sm bg-slate-50 dark:bg-slate-900/50">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                            <Briefcase className="w-4 h-4 text-primary" />
                                            ขอบเขตเคส
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm">
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-xs text-slate-500 font-medium">Ticket ID:</span>
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono truncate">{chatId}</code>
                                                <CopyButton value={chatId} className="h-6 w-6" />
                                            </div>
                                        </div>
                                        <div className="flex justify-between px-1">
                                            <span className="text-xs text-slate-500 font-medium">สถานะ:</span>
                                            <Badge variant={isCompleted ? "secondary" : (chatStatus === 'pending_payment' ? "destructive" : "default")} className="text-[10px] px-1.5 py-0">
                                                {isCompleted ? 'เสร็จสิ้น' : (chatStatus === 'pending_payment' ? "รอชำระเงิน" : 'กำลังดำเนินการ')}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between px-1">
                                            <span className="text-xs text-slate-500 font-medium">ค่าบริการ:</span>
                                            <span className="font-bold text-slate-900 dark:text-white">฿{chatAmount.toLocaleString()}</span>
                                        </div>

                                        {(caseTitle || description || installments?.length > 0) && (
                                            <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                                                {caseTitle && (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 font-medium mb-1">หัวข้อคดี/บริการ</p>
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white">{caseTitle}</p>
                                                    </div>
                                                )}
                                                {description && (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 font-medium mb-1">รายละเอียดขอบเขตงาน (Scope of Work)</p>
                                                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{description}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {installments && installments.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] text-slate-500 font-medium mb-1">แผนการชำระเงิน (Installments)</p>
                                                        <div className="space-y-1.5">
                                                            {installments.map((inst: any, idx: number) => {
                                                                const instAmount = inst.amount && !isNaN(parseFloat(inst.amount)) ? parseFloat(String(inst.amount).replace(/,/g, '')) : 0;
                                                                return (
                                                                    <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-xs shadow-sm">
                                                                        <span className="font-medium text-slate-700 dark:text-slate-300">งวดที่ {idx + 1}: {inst.description}</span>
                                                                        <span className="font-black text-blue-600 dark:text-blue-400 whitespace-nowrap ml-2">฿{instAmount.toLocaleString()}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                    {contractText && (
                                        <CardFooter className="pt-2">
                                            <Button 
                                                variant="outline" 
                                                className="w-full border-blue-200 text-blue-600 hover:bg-blue-50 text-xs h-9 font-bold rounded-xl"
                                                onClick={() => setShowContractModal(true)}
                                            >
                                                <ScrollText className="w-4 h-4 mr-2" /> ดูเอกสารสัญญาจ้าง
                                            </Button>
                                        </CardFooter>
                                    )}
                                </Card>
                            )}
                            
                            <Card className="border-none shadow-sm bg-slate-50 dark:bg-slate-900/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-white">
                                        <UserIcon className="w-4 h-4 text-blue-500" />
                                        โปรไฟล์ทนาย
                                    </CardTitle>
                                </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={getCloudflareVariantUrl(lawyer?.imageUrl, 'avatar')} />
                                        <AvatarFallback>{lawyer?.name?.charAt(0) || 'L'}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white leading-tight">{lawyer?.name || 'Lawyer'}</p>
                                        <p className="text-xs text-slate-500">สถานะ: {chatStatus === 'active' ? 'กำลังดำเนินการ' : 'รอการชำระเงิน'}</p>
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full text-xs h-9 rounded-xl border-slate-200" asChild disabled={!lawyer || !lawyerId}>
                                    <Link href={`/lawyer/${lawyerId || ''}`}>
                                        ดูโปรไฟล์ฉบับเต็ม
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="overview" className="mt-0 space-y-6">
                    {effectiveIsLawyerView && isOfficial && (
                        <Card className="border border-blue-200 shadow-sm bg-blue-50/10">
                            <CardHeader className="pb-3 border-b border-slate-100">
                                <CardTitle className="text-xs font-black uppercase text-blue-800 tracking-wider flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                    Lawyer Dashboard: จัดการความคืบหน้า (Milestones)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-2">
                                {milestones.length > 0 ? milestones.map((m) => {
                                    const isCompleted = m.status === 'completed';
                                    return (
                                        <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => handleToggleMilestone(m.id)}
                                                    className={cn("w-6 h-6 rounded-md flex items-center justify-center border-2 transition-all cursor-pointer", 
                                                        isCompleted ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 text-transparent hover:border-blue-400"
                                                    )}
                                                >
                                                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                                </button>
                                                <span className={cn("text-xs font-bold", isCompleted ? "text-slate-500 line-through" : "text-slate-800")}>{m.title}</span>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="text-center py-5 space-y-3">
                                        <p className="text-[11px] text-slate-500">คดีนี้ยังไม่ได้สร้างรายการความคืบหน้าในระบบ</p>
                                        <Button onClick={handleInitializeDefaultMilestones} className="bg-blue-600 hover:bg-blue-700 h-8 text-[11px] font-bold" size="sm">
                                            <Sparkles className="w-3 h-3 mr-1.5" />
                                            สร้างแผนดำเนินคดีมาตรฐาน 5 ขั้นตอน
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {isCompleted ? (
                        <Card className="border-green-100 shadow-xl shadow-green-500/5 bg-white">
                            <CardHeader className="pb-3 text-center text-sm font-bold">ให้คะแนนบริการ</CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-center gap-1.5 py-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button key={star} onClick={() => setRating(star)} className="focus:outline-none">
                                            <Scale className={cn("w-6 h-6 transition-all", rating >= star ? "text-amber-500 fill-amber-500" : "text-slate-300")} />
                                        </button>
                                    ))}
                                </div>
                                <Textarea placeholder="แชร์ความประทับใจ..." value={reviewText} onChange={(e) => setReviewText(e.target.value)} className="text-sm min-h-[80px]" />
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleSubmitReview} className="w-full font-bold h-9 text-xs" disabled={rating === 0}>ส่งรีวิว</Button>
                            </CardFooter>
                        </Card>
                    ) : (isManualCase && chatStatus === 'pending_payment') ? (
                        <Card className="border-blue-500 shadow-2xl ring-4 ring-blue-500/10 bg-white overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-blue-600 py-1.5 px-3 text-white text-center">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] italic">Official Case Proposal</p>
                            </div>
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                    <Briefcase className="w-5 h-5 text-blue-600" /> {caseTitle || "ข้อเสนอเริ่มดำเนินคดี"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed shadow-sm">
                                    <p className="font-bold mb-1.5 uppercase tracking-wider text-[9px] text-blue-600 dark:text-blue-400 flex items-center gap-1.5"><FileText className="w-3 h-3" /> ขอบเขตงาน (Scope of Work)</p>
                                    <p className="line-clamp-3 text-slate-700 dark:text-slate-200">{description || "ตามที่ระบุในสัญญาจ้างงาน"}</p>
                                </div>
                                
                                {installments && installments.length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">แผนการชำระเงิน ({installments.filter((i: any) => i.status === 'paid').length}/{installments.length} งวด)</p>
                                        <div className="space-y-2">
                                            {installments.map((inst: any, idx: number) => {
                                                const isPaid = inst.status === 'paid';
                                                const previousAllPaid = installments.slice(0, idx).every((prev: any) => prev.status === 'paid');
                                                const isNextToPay = !isPaid && previousAllPaid;
                                                const instAmount = inst.amount && !isNaN(parseFloat(inst.amount)) ? parseFloat(String(inst.amount).replace(/,/g, '')) : 0;

                                                return (
                                                    <div key={idx} className={cn(
                                                        "p-3 rounded-xl border transition-all",
                                                        isPaid 
                                                            ? "bg-green-50 border-green-200" 
                                                            : isNextToPay 
                                                                ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200/50 shadow-sm" 
                                                                : "bg-slate-50/50 border-slate-100/50 opacity-60"
                                                    )}>
                                                        <div className="flex justify-between items-center mb-1.5">
                                                            <span className={cn("text-[10px] font-bold", isPaid ? "text-green-700" : isNextToPay ? "text-blue-700" : "text-slate-400")}>
                                                                งวดที่ {idx + 1}
                                                            </span>
                                                            {isPaid ? (
                                                                <span className="text-[9px] font-black uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                    <CheckCircle2 className="w-3 h-3" /> ชำระแล้ว
                                                                </span>
                                                            ) : isNextToPay ? (
                                                                <span className="text-[9px] font-black uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full animate-pulse">
                                                                    รอชำระ
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9px] font-bold text-slate-300 uppercase">รอคิว</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium line-clamp-2 leading-tight">{inst.description}</p>
                                                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                                            <span className="font-black text-slate-800 dark:text-slate-100 text-sm">฿{instAmount.toLocaleString()}</span>
                                                            {isNextToPay && (
                                                                <Button size="sm" className="h-7 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-[10px] font-bold px-3 transition-colors shadow-md shadow-blue-500/20 whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0 text-white" asChild>
                                                                    <Link href={`/payment?chatId=${chatId}&lawyerId=${resolvedLawyerId}&amount=${instAmount}&type=installment&installmentIndex=${idx}`}>
                                                                        ชำระงวดนี้ <ArrowRight className="ml-1 w-3 h-3" />
                                                                    </Link>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-2xl border-2 border-blue-100 bg-blue-50/30 text-center shadow-inner">
                                        <p className="text-[10px] uppercase font-bold text-blue-600 mb-0.5 tracking-tighter">ค่าบริการรวมทั้งสิ้น</p>
                                        <p className="text-3xl font-black text-slate-900 tracking-tight">฿{chatAmount.toLocaleString()}</p>
                                    </div>
                                )}

                                {/* Total summary */}
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">ยอดรวมทั้งหมด</span>
                                    <span className="text-lg font-black text-slate-900">฿{chatAmount.toLocaleString()}</span>
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-col gap-2 bg-slate-50/50 border-t border-slate-100 p-5">
                                {(!installments || installments.length === 0) && (
                                    <Button className="w-full bg-[#0B3979] hover:bg-[#082a5a] font-black h-12 shadow-xl shadow-blue-500/20 text-white rounded-2xl text-sm" asChild>
                                        <Link href={`/payment?chatId=${chatId}&lawyerId=${resolvedLawyerId}&amount=${chatAmount}&type=case`}>
                                            ชำระเงินเพื่อเริ่มงาน <ArrowRight className="ml-2 w-4 h-4" />
                                        </Link>
                                    </Button>
                                )}
                                <p className="text-[9px] text-center text-slate-400 font-medium flex items-center justify-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-green-500" /> เงินถูกคุ้มครองโดยระบบ Lawlane Guarantee
                                </p>
                            </CardFooter>
                        </Card>
                    ) : pendingFeeRequest ? (
                        <Card className="border-amber-400 shadow-xl ring-4 ring-amber-400/10 bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700">
                                    <DollarSign className="w-5 h-5" />ข้อเสนอเปิดคดี
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs">
                                    <p className="font-bold underline mb-1">รายละเอียด:</p>
                                    <p>{pendingFeeRequest.reason || "ตามที่ตกลงในแชท"}</p>
                                </div>
                                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-center">
                                    <p className="text-[10px] uppercase font-bold text-amber-600 mb-0.5">ยอดชำระ</p>
                                    <p className="text-2xl font-black text-slate-900">฿{pendingFeeRequest.amount.toLocaleString()}</p>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full bg-amber-500 hover:bg-amber-600 font-bold h-10 shadow-lg text-white" asChild>
                                    <Link href={`/payment?chatId=${chatId}&lawyerId=${resolvedLawyerId}&amount=${pendingFeeRequest.amount}&type=additional`}>
                                        ชำระเงินเปิดห้องคดี
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ) : (
                        <Card className="border-none shadow-sm bg-slate-50">
                            <CardHeader className="pb-3 text-center">
                                <CardTitle className="text-xs font-semibold uppercase text-slate-400 tracking-widest">{chatAmount === 0 ? "Initial Chat" : "Official Case"}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-center pb-6">
                                {chatAmount === 0 ? (
                                    <div className="py-2">
                                        <p className="text-[10px] uppercase tracking-widest font-black text-green-600 mb-1">FREE CONSULT</p>
                                        <p className="text-xs text-slate-500 leading-relaxed">คุยเบื้องต้นฟรี ทนายจะส่งข้อเสนอราคาหากต้องดำเนินคดีต่อ</p>
                                    </div>
                                ) : (
                                    <div className="py-2">
                                        <p className="text-3xl font-black text-slate-900 mb-2">฿{chatAmount.toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-500">เงินถูกคุ้มครองโดยระบบ Lawlane</p>
                                        {effectiveIsLawyerView && <Button className="w-full mt-4 bg-green-600 hover:bg-green-700 font-bold h-9 text-xs" onClick={handleConfirmRelease}>ยืนยันปิดเคส</Button>}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
                

                
                <TabsContent value="vault">
                    <Card className={cn("border-none shadow-sm", isOfficial ? "bg-slate-50" : "opacity-60 grayscale bg-slate-100")}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                <Upload className="w-3.5 h-3.5" /> {tCase('legalVault')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                {files.length === 0 ? (
                                    <p className="text-center text-slate-400 text-[10px] py-12 uppercase tracking-widest font-medium">No documents</p>
                                ) : (
                                    files.map((file, idx) => {
                                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
                                        return (
                                        <div key={idx} className="flex justify-between items-center p-2 rounded-xl bg-white border border-slate-100 group hover:shadow-md transition-all">
                                            <button 
                                                onClick={() => handleViewFile(file.url, file.name)} 
                                                className="flex items-center gap-2.5 overflow-hidden flex-1 text-left"
                                            >
                                                <div className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                                                    isImage 
                                                        ? "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white" 
                                                        : "bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white"
                                                )}>
                                                    {isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={cn(
                                                        "text-xs font-bold truncate transition-colors",
                                                        isImage ? "text-slate-800 group-hover:text-purple-700" : "text-slate-800 group-hover:text-red-700"
                                                    )} title={file.name}>{file.name}</p>
                                                    <p className="text-[9px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                </div>
                                            </button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (confirm("ยืนยันการลบไฟล์นี้?")) {
                                                        const { deleteFileAction } = await import('@/app/actions/chat-actions');
                                                        const res = await deleteFileAction(chatId, file.url);
                                                        if (!res.success) {
                                                            toast({ variant: "destructive", title: "ลบไฟล์ไม่สำเร็จ", description: res.error });
                                                        }
                                                    }
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )})
                                )}
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <Button onClick={handleUploadClick} variant="outline" className="w-full text-xs h-9 border-dashed" disabled={isChatDisabled}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> อัปโหลดใหม่
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );

    return (
        <div className="relative h-[calc(100dvh-64px)] bg-slate-50 dark:bg-slate-950 z-[40] lg:z-0 overflow-hidden flex flex-col lg:flex-row w-full max-w-full overflow-x-hidden">
            {isAdminView && !isUserLawyer && (user?.uid !== client?.id) && (
                <div className="absolute top-0 left-0 right-0 z-[60] bg-amber-600 text-white text-[10px] md:text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-md animate-in fade-in slide-in-from-top duration-500">
                    <ShieldAlert className="w-3 h-3 md:w-4 md:h-4" />
                    คุณกำลังเข้าชมห้องแชทนี้ในฐานะผู้ดูแลระบบ (Admin View Mode)
                </div>
            )}
            {/* Main Area: Header + Operations (Flexible on mobile, scrollable) */}
            <div className="flex-none lg:flex-1 flex flex-col min-w-0 lg:h-full overflow-y-auto custom-scrollbar bg-slate-50/50">
                <div className="w-full max-w-4xl mx-auto px-4 lg:px-8 py-3 lg:py-8">
                    <div className="mb-2 lg:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="space-y-0.5">
                            <Link href={effectiveIsLawyerView ? "/lawyer-dashboard" : "/dashboard"} className="text-[10px] md:text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors font-medium">
                                <ArrowLeft className="w-3 h-3" />
                                {tCommon('backToHome')}
                            </Link>
                            
                            <h1 className="text-lg md:text-2xl lg:text-3xl font-bold font-headline flex flex-wrap items-center gap-2">
                                <span>{isOfficial ? tCase('titleOfficial') : tCase('titleInitial')}</span>
                                <Badge variant={isOfficial ? "default" : "secondary"} className={cn("rounded-lg uppercase text-[9px] tracking-widest px-1.5 py-0 whitespace-nowrap", isOfficial && "bg-amber-100 text-amber-700 border-amber-200")}>
                                    {isOfficial ? tCase('officialBadge') : tCase('freeBadge')}
                                </Badge>
                            </h1>
                        </div>

                        {/* Mobile Drawer Trigger */}
                        <div className="lg:hidden w-full">
                            <Drawer>
                                <DrawerTrigger asChild>
                                    <Button className="w-full bg-slate-900 hover:bg-black text-white rounded-xl h-10 text-xs font-bold flex items-center justify-center gap-2 shadow-sm">
                                        <Briefcase className="w-4 h-4" />
                                        จัดการคดี (Case Operations)
                                    </Button>
                                </DrawerTrigger>
                                <DrawerContent className="max-h-[90vh]">
                                    <DrawerHeader className="border-b pb-4">
                                        <DrawerTitle className="flex items-center gap-2 text-lg">
                                            <Briefcase className="w-5 h-5 text-blue-600" />
                                            จัดการคดี
                                        </DrawerTitle>
                                        <DrawerDescription>
                                            ตรวจสอบความคืบหน้า เอกสาร และการชำระเงิน
                                        </DrawerDescription>
                                    </DrawerHeader>
                                    <div className="p-4 overflow-y-auto">
                                        {renderOperationsPanel()}
                                    </div>
                                    <DrawerFooter className="pt-2 border-t mt-2">
                                        <DrawerClose asChild>
                                            <Button variant="outline" className="rounded-xl h-11">ปิด</Button>
                                        </DrawerClose>
                                    </DrawerFooter>
                                </DrawerContent>
                            </Drawer>
                        </div>
                    </div>

                    <div className="hidden lg:block w-full">
                        {renderOperationsPanel()}
                    </div>
                </div>
            </div>

            {/* Sidebar Area: Chat Column (Takes remaining height on mobile) */}
            <div className="flex-1 lg:flex-none w-full lg:w-[400px] xl:w-[480px] min-h-0 flex flex-col relative z-10 bg-white dark:bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 shadow-2xl lg:shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)]">
                <div className="flex-1 overflow-hidden relative">
                    <ChatBox 
                        chatId={chatId} 
                        currentUser={user} 
                        otherUser={otherUser}
                        isDisabled={isChatDisabled}
                        isLawyerView={effectiveIsLawyerView}
                        firestore={firestore}
                        isUploading={isUploading}
                        onFileUpload={executeFileUpload}
                    />
                </div>
            </div>

            {/* Image Preview Modal */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-4xl w-[95vw] h-[80vh] flex flex-col p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
                    <DialogHeader className="p-4 border-b bg-white flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <ImageIcon className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-sm font-bold truncate max-w-[200px] md:max-w-md">{previewFile?.name}</DialogTitle>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Document Preview</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pr-8">
                            <Button size="sm" variant="outline" className="rounded-full text-xs h-8" onClick={() => window.open(previewFile?.url, '_blank')}>
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Full screen
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

            {/* Contract Modal */}
            <Dialog open={showContractModal} onOpenChange={setShowContractModal}>
                <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none bg-slate-900/40 backdrop-blur-md">
                    <DialogTitle className="sr-only">เอกสารสัญญาจ้าง</DialogTitle>
                    <div className="flex flex-col items-center gap-12 p-4 md:p-12 pb-24">
                        {/* PAGE 1 */}
                        <Card className="bg-white shadow-2xl rounded-sm w-full max-w-[210mm] relative overflow-hidden font-serif leading-[1.8] min-h-[297mm] h-auto flex flex-col">
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
                                <img src="/images/logo-lawslane-transparent-color.png" alt="Lawslane Watermark" className="w-[80%]" />
                            </div>
                            <CardContent className="p-12 md:p-20 space-y-8 text-slate-800 text-[15px] relative z-10 flex-1">
                                <div className="text-center space-y-2 mb-10">
                                    <h1 className="text-3xl font-bold text-slate-900 font-headline italic uppercase tracking-wider">สัญญาจ้างทนายความ</h1>
                                    <p className="text-slate-500 text-xs tracking-widest uppercase font-sans">(ฉบับทางการ - Lawslane Standard)</p>
                                </div>

                                <div className="space-y-6">
                                    <p className="indent-12 text-justify">
                                        สัญญาฉบับนี้ทำขึ้นระหว่าง <strong>{client?.name || '.....................'}</strong>
                                        {clientInfo?.taxId ? ` เลขประจำตัวผู้เสียภาษี ${clientInfo.taxId}` : ''}
                                        {clientInfo?.address ? ` ตั้งอยู่เลขที่ ${clientInfo.address}` : ''}
                                        ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>"ผู้ว่าจ้าง"</strong> ฝ่ายหนึ่ง
                                    </p>

                                    <p className="indent-12 text-justify">
                                        กับ <strong>ทนายความในเครือ Lawslane</strong>
                                        ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>"ผู้รับจ้าง"</strong> อีกฝ่ายหนึ่ง
                                    </p>

                                    <div className="space-y-6 pt-2 pl-6 border-l-4 border-blue-50">
                                        <div>
                                            <p className="font-bold">ข้อ 1. ขอบเขตของงาน</p>
                                            <p className="pl-6 text-slate-600 italic py-1 leading-relaxed">{description || caseTitle}</p>
                                        </div>

                                        <div>
                                            <p className="font-bold">ข้อ 2. ค่าจ้างและเงื่อนไขการชำระเงิน</p>
                                            <p className="pl-6">
                                                ผู้ว่าจ้างตกลงชำระค่าจ้างทั้งสิ้น <strong>{chatAmount.toLocaleString()}</strong> บาท
                                                <br />เงื่อนไขการชำระเงิน: {installments?.length > 0 ? 'แบ่งชำระเป็นงวด' : 'ชำระงวดเดียวเมื่อเริ่มงาน'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <div className="p-4 bg-slate-50 text-center text-[10px] text-slate-400 font-sans tracking-widest border-t border-slate-100">Page 1 of 2</div>
                        </Card>

                        {/* PAGE 2 */}
                        <Card className="bg-white shadow-2xl rounded-sm w-full max-w-[210mm] relative overflow-hidden font-serif leading-[1.8] min-h-[297mm] h-auto flex flex-col">
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
                                <img src="/images/logo-lawslane-transparent-color.png" alt="Lawslane Watermark" className="w-[80%]" />
                            </div>
                            <CardContent className="p-12 md:p-20 space-y-8 text-slate-800 text-[15px] relative z-10 flex-1">
                                <div className="space-y-6">
                                    <p className="indent-12 text-justify pt-8 leading-relaxed">
                                        สัญญานี้เป็นการสรุปข้อตกลงเบื้องต้นจากการเจรจาผ่านทางระบบ Lawslane คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงได้ลงลายมือชื่อผ่านระบบอิเล็กทรอนิกส์ไว้เป็นสำคัญ
                                    </p>

                                    {installments?.length > 0 && (
                                        <div className="mt-12 pt-8 border-t border-slate-100">
                                            <p className="font-bold mb-4 flex items-center gap-2 text-blue-600">
                                                <DollarSign className="w-4 h-4" /> แผนการชำระเงินแนบท้าย:
                                            </p>
                                            <ul className="space-y-3 pl-6">
                                                {installments.map((inst: any, idx: number) => (
                                                    <li key={idx} className="text-sm flex justify-between border-b border-slate-50 pb-2">
                                                        <span>งวดที่ {idx + 1}: {inst.description}</span>
                                                        <span className="font-bold">฿{(parseFloat(String(inst.amount).replace(/,/g, ''))).toLocaleString()}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="flex justify-around items-end pt-24 text-sm mt-16 border-t border-slate-100">
                                        <div className="text-center space-y-4 flex-1">
                                            <div className="h-20 flex items-center justify-center italic text-slate-300 text-xs">
                                                (ลงนามผ่านระบบ)
                                            </div>
                                            <p className="font-bold text-slate-900 underline underline-offset-8">...........................................................</p>
                                            <p className="text-xs text-slate-500 font-sans">({client?.name || 'ผู้ว่าจ้าง'})</p>
                                        </div>

                                        <div className="text-center space-y-4 flex-1">
                                            <div className="h-20 flex items-center justify-center">
                                                <img src="/images/lawslane-official-seal.png" alt="Official Seal" className="h-16 opacity-80" onError={(e) => e.currentTarget.style.display = 'none'} />
                                            </div>
                                            <p className="font-bold text-slate-900 underline underline-offset-8">...........................................................</p>
                                            <p className="text-xs text-slate-500 font-sans">({lawyer?.name || 'ทนายความผู้รับผิดชอบคดี'})</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <div className="p-4 bg-slate-50 text-center text-[10px] text-slate-400 font-sans tracking-widest border-t border-slate-100">Page 2 of 2</div>
                        </Card>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function ChatPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
            <ChatPageContent />
        </Suspense>
    );
}
