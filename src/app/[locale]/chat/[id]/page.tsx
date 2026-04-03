'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getLawyerById } from '@/lib/data';
import type { LawyerProfile } from '@/lib/types';
import { useFirebase, useUser } from '@/firebase';
import { ChatBox } from '@/components/chat/chat-box';
import { uploadFileAction } from '../actions';
import { requestFeeAction } from '@/app/actions/chat-actions';
import { submitReviewAction } from '@/app/actions/review-actions';
import { useTranslations } from 'next-intl';
import { CaseRoadmap } from '@/components/case/case-roadmap';
import { LegalResearchTool } from '@/components/case/legal-research-tool';
import { InterpreterSearchTool } from '@/components/case/interpreter-search-tool';
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
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText, Check, Upload, Scale, Ticket, Briefcase, User as UserIcon, DollarSign, ArrowLeft, Plus, Sparkles, BrainCircuit, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/ui/copy-button';
import Link from 'next/link';
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
    const [files, setFiles] = useState<{ name: string, url: string, size: number }[]>([]);
    const [chatStatus, setChatStatus] = useState<string>(searchParams.get('status') || 'active');
    const [chatAmount, setChatAmount] = useState<number>(0);
    const [pendingFeeRequest, setPendingFeeRequest] = useState<{ amount: number, reason: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const tCase = useTranslations('CaseRoom');
    const tCommon = useTranslations('Dashboard');

    const isCompleted = chatStatus === 'closed';
    const isLawyerView = view === 'lawyer';
    const [isChatDisabled, setIsChatDisabled] = useState(isCompleted);

    const isOfficial = chatAmount > 0;
    const currentStep = isCompleted ? 4 : (isOfficial ? 3 : (pendingFeeRequest ? 2 : 1));

    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState("");

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
                setPendingFeeRequest(data.pendingFeeRequest || null);
            }
        });

        return () => unsubscribe();
    }, [firestore, chatId, user]);

    useEffect(() => {
        if (!firestore) return;
        async function fetchData() {
            setIsLoading(true);
            let effectiveLawyerId = lawyerId;

            if (!effectiveLawyerId && chatId) {
                const chatRef = doc(firestore!, 'chats', chatId);
                const chatSnap = await getDoc(chatRef);
                if (chatSnap.exists()) {
                    const chatData = chatSnap.data();
                    effectiveLawyerId = chatData.lawyerId || chatData.participants?.find((p: string) => p !== user?.uid);
                }
            }

            if (effectiveLawyerId) {
                const lawyerData = await getLawyerById(firestore!, effectiveLawyerId);
                setLawyer(lawyerData || null);
            }
            if (isLawyerView && clientId) {
                const clientRef = doc(firestore!, 'users', clientId);
                const userDocSnap = await getDoc(clientRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    setClient({ id: clientId, name: userData.name, imageUrl: userData.avatar || '' });
                }
            }
            setIsLoading(false);
        }
        fetchData();
    }, [lawyerId, clientId, isLawyerView, firestore, chatId, user]);

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user || !storage || !firestore) return;

        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast({ variant: "destructive", title: "ไฟล์มีขนาดใหญ่เกินไป", description: `ไม่เกิน ${MAX_FILE_SIZE_MB}MB` });
            return;
        }

        try {
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

            toast({ title: "อัปโหลดไฟล์สำเร็จ", description: `ไฟล์ "${file.name}" ถูกเพิ่มแล้ว` });
        } catch (error: any) {
            toast({ variant: "destructive", title: "อัปโหลดไม่สำเร็จ", description: error.message });
        }
        if (event.target) event.target.value = '';
    };

    const handleConfirmRelease = async () => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'chats', chatId), {
                status: 'closed',
                closedAt: serverTimestamp()
            });
            toast({ title: "ดำเนินการสำเร็จ", description: "เคสเสร็จสมบูรณ์แล้ว" });
            setTimeout(() => {
                router.push(`/review/${chatId}?lawyerId=${lawyerId}`);
            }, 1500);
        } catch (error) {
            toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: "ไม่สามารถปิดเคสได้" });
        }
    };

    const handleSubmitReview = async () => {
        if (rating === 0 || !user || !lawyerId) return;
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


    if (isLoading) return <div className="flex h-screen items-center justify-center">Loading chat...</div>;

    const chatPartner = isLawyerView ? client : lawyer;
    if (!chatPartner || !user || !firestore) return <div>Unable to load chat. Missing information.</div>;

    const otherUser = {
        name: isLawyerView ? (client?.name ?? 'Client') : (lawyer?.name ?? 'Lawyer'),
        userId: isLawyerView ? (client?.id ?? '') : (lawyer?.userId || lawyer?.id || ''),
        imageUrl: isLawyerView ? (client?.imageUrl ?? "") : (lawyer?.imageUrl ?? ''),
    };

    return (
        <div className="container mx-auto px-4 md:px-6 py-8">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <Link href={isLawyerView ? "/lawyer-dashboard" : "/dashboard"} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {tCommon('backToHome')}
                    </Link>
                    <h1 className="text-2xl font-bold font-headline mt-1 flex items-center gap-2">
                        {isOfficial ? tCase('titleOfficial') : tCase('titleInitial')}
                        <Badge variant={isOfficial ? "default" : "secondary"} className={cn("rounded-full uppercase text-[10px] tracking-widest px-2 py-0", isOfficial && "bg-amber-100 text-amber-700 border-amber-200")}>
                            {isOfficial ? tCase('officialBadge') : tCase('freeBadge')}
                        </Badge>
                    </h1>
                </div>
                {isOfficial && (
                    <div className="flex-1 max-w-xl">
                        <CaseRoadmap currentStep={currentStep} isPremium={isOfficial} />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                <div className="xl:col-span-3 h-[calc(100vh-220px)] min-h-[600px] flex flex-col">
                    <div className="flex-1 min-h-0">
                        <ChatBox firestore={firestore} currentUser={user} otherUser={otherUser} chatId={chatId} isDisabled={isChatDisabled} isLawyerView={isLawyerView} />
                    </div>
                </div>
                
                <div className="xl:col-span-1 space-y-6">
                    <Tabs defaultValue="info" className="w-full">
                        <TabsList className={cn("w-full flex p-1 h-auto min-h-12 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl mb-4", isLawyerView && isOfficial ? "gap-1" : "gap-2")}>
                            <TabsTrigger value="info" className="flex-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest py-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                {tCommon('viewDetails')}
                            </TabsTrigger>
                            <TabsTrigger value="vault" className="flex-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest py-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                {tCase('legalVault').split(' ')[0]}
                            </TabsTrigger>
                            {isLawyerView && isOfficial && (
                                <TabsTrigger value="tools" className="flex-1 text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 py-1.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm leading-tight text-center">
                                    <Sparkles className="w-2.5 h-2.5 text-blue-500 shrink-0" /> 
                                    <span className="break-words">{tCase('proTools')}</span>
                                </TabsTrigger>
                            )}
                        </TabsList>
                        
                        <TabsContent value="info" className="space-y-6">
                            {isLawyerView ? (
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
                                                <AvatarImage src={otherUser.imageUrl} />
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
                                            <Badge variant={isCompleted ? "secondary" : (pendingFeeRequest ? "destructive" : "default")} className="text-[10px] px-1.5 py-0">
                                                {isCompleted ? 'เสร็จสิ้น' : (pendingFeeRequest ? "รอชำระเงิน" : 'กำลังดำเนินการ')}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between px-1">
                                            <span className="text-xs text-slate-500 font-medium">ค่าบริการ:</span>
                                            <span className="font-bold text-slate-900 dark:text-white">฿{chatAmount.toLocaleString()}</span>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex-col gap-2 pt-2">
                                        {!isCompleted && (
                                            <>
                                                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-xs h-10 font-bold rounded-2xl shadow-lg shadow-blue-500/20" asChild>
                                                    <Link href={`/lawyer-dashboard/pipeline/new?chatId=${chatId}&clientId=${clientId}`}>
                                                        <Plus className="w-4 h-4 mr-2" /> เสนอราคาเปิดคดี
                                                    </Link>
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
                            ) : isCompleted ? (
                                <Card className="border-green-100 bg-green-50/30">
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
                                            <Link href={`/payment?chatId=${chatId}&lawyerId=${lawyerId}&amount=${pendingFeeRequest.amount}&type=additional`}>
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
                                                <Button className="w-full mt-4 bg-green-600 hover:bg-green-700 font-bold h-9 text-xs" onClick={handleConfirmRelease}>ยืนยันปิดเคส</Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>
                        
                        <TabsContent value="tools" className="space-y-4">
                            {isLawyerView && isOfficial && (
                                <>
                                    <Card className="border-blue-100 bg-blue-50/20 overflow-hidden shadow-sm">
                                        <div className="p-4 bg-white/60 border-b border-blue-100">
                                            <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2 italic">
                                                <BrainCircuit className="w-4 h-4" /> Legal Research (RAG)
                                            </h4>
                                        </div>
                                        <LegalResearchTool 
                                            onCite={(text) => toast({ title: "Cite successful", description: "Selected text cited to chat." })} 
                                            className="h-[350px] border-none" 
                                        />
                                    </Card>

                                    <Card className="border-indigo-100 bg-indigo-50/20 overflow-hidden shadow-sm">
                                        <div className="p-4 bg-white/60 border-b border-indigo-100">
                                            <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest flex items-center gap-2 italic">
                                                <Globe className="w-4 h-4" /> Global Interpreters
                                            </h4>
                                        </div>
                                        <InterpreterSearchTool 
                                            className="h-[400px] border-none" 
                                        />
                                    </Card>
                                </>
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
                                            files.map((file, idx) => (
                                                <div key={idx} className="flex justify-between items-center p-2 rounded-xl bg-white border border-slate-100 group hover:shadow-md transition-all">
                                                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 overflow-hidden flex-1">
                                                        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
                                                            <FileText className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold truncate text-slate-800" title={file.name}>{file.name}</p>
                                                            <p className="text-[9px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                        </div>
                                                    </a>
                                                </div>
                                            ))
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
            </div>
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
