'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getLawyerById } from '@/lib/data';
import type { LawyerProfile } from '@/lib/types';
import { useFirebase, useUser } from '@/firebase';
import { ChatBox } from '@/components/chat/chat-box';
import { uploadFileAction } from '../actions';
import { 
    requestFeeAction, 
    getChatDetailsAction, 
    ensureChatExistsAction,
    sendChatMessageAction,
    approveInstallmentAction
} from '@/app/actions/chat-actions';
import { submitReviewAction } from '@/app/actions/review-actions';
import { getCaseMilestones, toggleMilestoneStatusAction, addCaseMilestoneAction } from '@/app/actions/lawyer-case-actions';
import type { Milestone } from '@/lib/types/billing-types';
import { getUserDashboardData } from '@/app/actions/dashboard-actions';
import { useTranslations } from 'next-intl';
import { getSecureDownloadUrl } from '@/app/actions/secure-view';
import { CaseRoadmap } from '@/components/case/case-roadmap';
import { LegalResearchTool } from '@/components/case/legal-research-tool';
import { getInvoicesByChatAction, getContractsByChatAction, signContractAction } from '@/app/actions/billing-actions';
import { SignaturePad } from '@/components/ui/signature-pad';
import { repairChatDocumentsAction } from '@/app/actions/lawyer-actions';
import { Invoice } from '@/lib/types/billing-types';
import { FileSignature, ReceiptText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCloudflareVariantUrl } from '@/lib/cloudflare-images';
import profileLawyerImg from '@/pic/profile-lawyer.jpg';

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
import { AlertTriangle, FileText, Check, Upload, Scale, Ticket, Briefcase, User as UserIcon, DollarSign, ArrowLeft, Plus, Sparkles, BrainCircuit, Globe, ArrowRight, CheckCircle2, Loader2, Image as ImageIcon, Trash2, ShieldAlert, ExternalLink, ScrollText, ChevronLeft, Search, Info, Download, Maximize2, FileDown } from 'lucide-react';
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
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { CopyButton } from '@/components/ui/copy-button';
import { Link } from '@/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { doc, getDoc, updateDoc, arrayUnion, onSnapshot, serverTimestamp, query, collection, where, orderBy } from 'firebase/firestore';
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
    const [client, setClient] = useState<{ id: string, name: string, imageUrl: string, email?: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [files, setFiles] = useState<{ name: string, url: string, size: number }[]>([]);
    const [chatStatus, setChatStatus] = useState<string>(searchParams.get('status') || 'active');
    const [chatAmount, setChatAmount] = useState<number>(0);
    const chatAmountRef = useRef(0);
    const [isManualCase, setIsManualCase] = useState<boolean>(false);
    const [installments, setInstallments] = useState<any[]>([]);
    const installmentsRef = useRef<any[]>([]);

    useEffect(() => { chatAmountRef.current = chatAmount; }, [chatAmount]);
    useEffect(() => { installmentsRef.current = installments; }, [installments]);
    const [caseTitle, setCaseTitle] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [pendingFeeRequest, setPendingFeeRequest] = useState<{ amount: number, reason: string } | null>(null);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isAdminView, setIsAdminView] = useState(false);
    const [accessError, setAccessError] = useState<string | null>(null);
    const { toast } = useToast();
    const { firestore, storage } = useFirebase();
    const { user } = useUser();

    // Fetch Invoices, Contracts and Milestones via Server Actions (to avoid permission/index errors)
    const fetchDocs = useCallback(async (cId?: string, lId?: string) => {
        if (!chatId) return;
        console.log("Fetching docs for chatId:", chatId);
        
        const targetClientId = cId || clientId || undefined;
        const targetLawyerId = lId || lawyerId || undefined;
        const normalizedChatId = Array.isArray(chatId) ? chatId[0] : (chatId as string);

        const [invRes, conRes, msRes] = await Promise.all([
            getInvoicesByChatAction(normalizedChatId, targetClientId, targetLawyerId),
            getContractsByChatAction(normalizedChatId, targetClientId),
            getCaseMilestones(normalizedChatId)
        ]);
        
        console.log("Docs found:", { invoices: invRes.data?.length, contracts: conRes.data?.length, milestones: msRes?.length });
        
        if (invRes.success) {
            setInvoices(invRes.data || []);
        }
        
        if (conRes.success) {
            setContracts(conRes.data || []);
        }
        
        // Use local calculation of isOfficial to avoid stale closure issues
        const currentIsOfficial = chatAmountRef.current > 0 || (installmentsRef.current && installmentsRef.current.length > 0);

        // AUTO-REPAIR: If case is official but no invoices found, trigger repair
        if (currentIsOfficial && (!invRes.data || invRes.data.length === 0)) {
            console.log("Triggering auto-repair for missing documents...");
            const repairRes = await repairChatDocumentsAction(chatId);
            if (repairRes.success) {
                // Refresh docs after repair
                const refreshedInvoices = await getInvoicesByChatAction(chatId, clientId ?? undefined, lawyerId ?? undefined);
                if (refreshedInvoices.success) setInvoices(refreshedInvoices.data || []);
            }
        }
        
        // Milestones
        if (msRes && msRes.length > 0) {
            const sorted = [...msRes].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setMilestones(sorted);
        }
    }, [chatId, clientId, lawyerId]); // Removed chatAmount, installments to avoid identity changes during data sync

    useEffect(() => {
        fetchDocs();
    }, [fetchDocs]);


    const tCase = useTranslations('CaseRoom');
    const tCommon = useTranslations('Dashboard');

    const isCompleted = chatStatus === 'closed';
    const [effectiveIsLawyerView, setEffectiveIsLawyerView] = useState(view === 'lawyer');
    const [isUserLawyer, setIsUserLawyer] = useState(false);
    const [isChatDisabled, setIsChatDisabled] = useState(isCompleted);
    const [previewFile, setPreviewFile] = useState<{ url: string, name: string, type: 'image' | 'pdf' | 'other' } | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const [clientInfo, setClientInfo] = useState<{ name: string, address: string, taxId: string } | null>(null);
    const isOfficial = chatAmount > 0 || (installments && installments.length > 0);
    const totalPaid = installments.filter(inst => inst.status === 'paid').reduce((sum, inst) => {
        const amt = inst.amount && !isNaN(parseFloat(String(inst.amount).replace(/,/g, ''))) ? parseFloat(String(inst.amount).replace(/,/g, '')) : 0;
        return sum + amt;
    }, 0);

    // Compute milestoneSteps and currentStep from real milestones
    // Sort milestones by order to ensure consistency
    const sortedMilestones = [...milestones].sort((a, b) => (a.order || 0) - (b.order || 0));

    const milestoneSteps = sortedMilestones.length > 0 ? sortedMilestones.map((m, idx) => ({
      id: idx + 1,
      label: m.title,
      icon: m.status === 'completed' ? CheckCircle2 : FileText,
      date: m.status === 'completed' ? '✓ เสร็จสิ้น' : undefined,
    })) : undefined;

    // Find the first pending milestone to determine the current phase
    const firstPendingIndex = sortedMilestones.findIndex(m => m.status !== 'completed');
    
    const currentStep = isCompleted 
      ? (sortedMilestones.length > 0 ? sortedMilestones.length : 5) 
      : sortedMilestones.length > 0 
        ? (firstPendingIndex === -1 ? sortedMilestones.length : firstPendingIndex + 1)
        : (isOfficial ? 4 : (pendingFeeRequest ? 2 : 1));

    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [showContractModal, setShowContractModal] = useState(false);
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [signingRole, setSigningRole] = useState<'client' | 'lawyer' | null>(null);
    const [selectedContract, setSelectedContract] = useState<any>(null);

    // Hide navbar on mobile for this page only
    useEffect(() => {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            const header = document.querySelector('header');
            if (header) {
                const originalDisplay = header.style.display;
                header.style.display = 'none';
                return () => {
                    header.style.display = originalDisplay;
                };
            }
        }
    }, []);

    const [contractText, setContractText] = useState<string | null>(null);


    const CaseDetailsContent = () => (
        <div className="space-y-6">
            {renderOperationsPanel()}
        </div>
    );

    const fetchDocsRef = useRef(fetchDocs);
    useEffect(() => {
        fetchDocsRef.current = fetchDocs;
    }, [fetchDocs]);

    useEffect(() => {
        if (!firestore || !chatId || !user) return;
        const chatRef = doc(firestore, 'chats', chatId);
        const unsubscribe = onSnapshot(chatRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
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
                
                // Trigger document refetch when chat document changes
                const chatData = docSnap.data();
                if (chatData) {
                    const cId = chatData.clientId || chatData.userId;
                    const lId = chatData.lawyerId;
                    fetchDocsRef.current(cId, lId);
                }
            }
        });

        return () => unsubscribe();
    }, [firestore, chatId, user]); // Stabilized: Only re-run when chatId or user identity changes


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
                    if (!fetchedLawyer) {
                        fetchedLawyer = { id: currentLawyerId, name: '', imageUrl: '', email: '' } as unknown as LawyerProfile;
                    }
                    try {
                        const lUserSnap = await getDoc(doc(firestore!, 'users', currentLawyerId));
                        if (lUserSnap.exists()) {
                            const lUserData = lUserSnap.data();
                            fetchedLawyer.email = fetchedLawyer.email || lUserData.email || '';
                            if (!fetchedLawyer.name || fetchedLawyer.name === 'ทนายความ' || fetchedLawyer.name === 'Unknown Lawyer') {
                                fetchedLawyer.name = lUserData.name || fetchedLawyer.name;
                            }
                        }
                    } catch (e) {
                        console.warn("Could not fetch fallback lawyer info", e);
                    }
                    if (chatData?.lawyerUserId && !fetchedLawyer.userId) {
                        fetchedLawyer.userId = chatData.lawyerUserId;
                    }
                    setLawyer(fetchedLawyer);
                }
                
                if (currentClientId) {
                    let resolvedName = 'ลูกความ';
                    let resolvedAvatar = '';
                    let resolvedEmail = '';

                    try {
                        const clientRef = doc(firestore!, 'users', currentClientId);
                        const userDocSnap = await getDoc(clientRef);
                        
                        if (userDocSnap.exists()) {
                            const userData = userDocSnap.data();
                            resolvedName = userData.name || 'ลูกความ';
                            resolvedAvatar = userData.avatar || '';
                            resolvedEmail = userData.email || '';
                        }
                    } catch (e) {
                        console.warn("Could not fetch client profile directly (likely permission rules):", e);
                        // We will fallback to names from chatData or user object below
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
                        if (!resolvedEmail) resolvedEmail = user.email || '';
                        
                        // AUTO-REPAIR: Create/Fix the missing profile document
                        const clientRef = doc(firestore!, 'users', currentClientId);
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
                    
                    setClient({ id: currentClientId, name: resolvedName, imageUrl: resolvedAvatar, email: resolvedEmail });
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
        
        // Safety timeout in case fetchData hangs on a broken promise
        const fallbackTimer = setTimeout(() => {
            setIsLoading(false);
        }, 3000);
        
        fetchData().finally(() => clearTimeout(fallbackTimer));
    }, [lawyerId, clientId, firestore, chatId, user, view]);

    const handleUploadClick = () => fileInputRef.current?.click();

    const executeFileUpload = async (file: File) => {
        if (!file || !user || !storage || !firestore) return;

        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast({ variant: "destructive", title: "ไฟล์มีขนาดใหญ่เกินไป", description: `ไม่เกิน ${MAX_FILE_SIZE_MB}MB` });
            return;
        }


        const normalizedChatId = Array.isArray(chatId) ? chatId[0] : (chatId as string);
        
        try {
            setIsUploading(true);
            toast({ title: "กำลังอัปโหลด...", description: `กำลังอัปโหลดไฟล์ "${file.name}"` });
            const idToken = await user.getIdToken();
            const formData = new FormData();
            formData.append('file', file);

            const result = await uploadFileAction(formData, idToken, normalizedChatId);
            
            toast({ title: "Upload Result", description: JSON.stringify(result) });

            if (!result || !result.fullPath) {
                throw new Error("ระบบอัปโหลดไม่คืนค่าตำแหน่งไฟล์ (Full Path is missing)");
            }

            const fileData = {
                name: file.name,
                url: result.fullPath,
                size: file.size,
                uploadedBy: user.uid,
                uploadedAt: Date.now()
            };

            await updateDoc(doc(firestore, 'chats', normalizedChatId), {
                files: arrayUnion(fileData)
            });

            toast({ title: "บันทึกข้อมูลไฟล์แล้ว", description: "กำลังส่งข้อความยืนยันลงในแชท..." });

            // 10. NOTIFY counterpart about the new document
            try {
                const authToken = await user.getIdToken();
                const notifyResult = await sendChatMessageAction({
                    chatId: normalizedChatId,
                    text: `[อัปโหลดไฟล์] ${file.name}`,
                    senderId: user.uid,
                    senderName: effectiveIsLawyerView ? (user.displayName || 'ทนายความ') : (user.displayName || 'ลูกความ'),
                    recipientId: otherUser.userId || '',
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
        const files = event.target.files;
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                await executeFileUpload(files[i]);
            }
        }
        if (event.target) event.target.value = '';
    };

    const handleViewFile = async (path: string, fileName?: string) => {
        if (!path) return;
        
        const isImage = fileName ? /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName) : false;
        const isPDF = fileName ? /\.pdf$/i.test(fileName) : false;

        if (path.startsWith('http')) {
            if (isImage) {
                setPreviewFile({ url: path, name: fileName || 'Image', type: 'image' });
                setIsPreviewOpen(true);
            } else if (isPDF) {
                setPreviewFile({ url: path, name: fileName || 'Document', type: 'pdf' });
                setIsPreviewOpen(true);
            } else {
                window.open(path, '_blank');
            }
            return;
        }

        try {
            if (isImage || isPDF) {
                const url = await getSecureDownloadUrl(path, chatId, undefined, 'inline');
                if (url) {
                    setPreviewFile({ url, name: fileName || 'Document', type: isImage ? 'image' : 'pdf' });
                    setIsPreviewOpen(true);
                } else {
                    toast({ variant: "destructive", title: "ไม่สามารถเข้าถึงไฟล์ได้", description: "กรุณาลองใหม่อีกครั้ง" });
                }
            } else {
                const url = await getSecureDownloadUrl(path, chatId, undefined, 'attachment');
                if (url) {
                    // Use hidden link to avoid popup blockers
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', fileName || 'download');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    toast({ variant: "destructive", title: "ไม่สามารถเข้าถึงไฟล์ได้", description: "กรุณาลองใหม่อีกครั้ง" });
                }
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
            // Sequential execution to ensure order
            for (let i = 0; i < defaultTitles.length; i++) {
                await addCaseMilestoneAction(chatId, defaultTitles[i], i + 1);
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

    if (!user || !firestore) {
        if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin" /> กำลังโหลดข้อมูล...</div>;
        return <div className="flex justify-center items-center h-screen text-slate-500">กรุณาเข้าสู่ระบบเพื่อใช้งานแชท</div>;
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
            {/* Roadmap and Overview removed per user request to simplify UI */}
            
            <Tabs defaultValue="info" className="w-full relative z-30 pointer-events-auto">
                <TabsList className="w-full bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl h-11 flex gap-1 border border-slate-300 dark:border-slate-700 relative z-[100] pointer-events-auto shadow-sm">
                    <TabsTrigger value="info" className="min-w-0 px-2 flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 transition-all duration-300 cursor-pointer pointer-events-auto">
                        <span className="truncate">{tCommon('viewDetails') || 'รายละเอียด'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="vault" className="min-w-0 px-2 flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 transition-all duration-300 relative cursor-pointer pointer-events-auto">
                        <span className="truncate">{tCase('legalVault')?.split(' ')[0] || 'คลังเอกสาร'}</span>
                        {files.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-white pointer-events-none">
                                {files.length}
                            </span>
                        )}
                    </TabsTrigger>

                </TabsList>
                
                <TabsContent value="info" className="space-y-6">
                    {effectiveIsLawyerView ? (
                        <Card className="border-none bg-white dark:bg-slate-900/50 rounded-[2rem] overflow-hidden">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-primary" />
                                    ขอบเขตเคส
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
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
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 pl-1">แผนการชำระเงิน (Installments)</p>
                                                <div className="space-y-2">
                                                    {installments.map((inst: any, idx: number) => {
                                                        const isPaid = inst.status === 'paid';
                                                        const isPending = inst.status === 'pending_verification';
                                                        const instAmount = inst.amount && !isNaN(parseFloat(inst.amount)) ? parseFloat(String(inst.amount).replace(/,/g, '')) : 0;
                                                        return (
                                                            <div key={idx} className={cn(
                                                                "p-3 rounded-xl border transition-all flex justify-between items-center",
                                                                isPaid ? "bg-emerald-50 border-emerald-100" : isPending ? "bg-amber-50 border-amber-200" : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                                                            )}>
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">งวดที่ {idx + 1}</span>
                                                                        {isPaid ? (
                                                                            <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md">ชำระแล้ว</span>
                                                                        ) : isPending ? (
                                                                            <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md animate-pulse">รอตรวจสอบ</span>
                                                                        ) : null}
                                                                    </div>
                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{inst.description}</span>
                                                                </div>
                                                                <div className="text-right flex flex-col items-end gap-1">
                                                                    <span className="font-black text-blue-600 dark:text-blue-400 text-sm">฿{instAmount.toLocaleString()}</span>
                                                                    {isPaid && inst.slipUrl && (
                                                                        <button onClick={() => handleViewFile(inst.slipUrl, `slip_installment_${idx}.jpg`)} className="text-[8px] font-bold text-emerald-600 hover:underline">ดูสลิป</button>
                                                                    )}
                                                                    {isPending && inst.slipUrl && (
                                                                        <div className="flex flex-col items-end gap-1">
                                                                            <Button variant="outline" size="sm" className="h-5 text-[8px] border-amber-200 text-amber-600 bg-amber-50 px-1 font-bold" onClick={() => handleViewFile(inst.slipUrl, `slip_installment_${idx}.jpg`)}>
                                                                                ดูสลิป
                                                                            </Button>
                                                                            <Button 
                                                                                size="sm" 
                                                                                className="h-5 text-[8px] bg-emerald-600 hover:bg-emerald-700 text-white px-1.5 font-black rounded-md"
                                                                                onClick={async () => {
                                                                                    if (confirm('ยืนยันการชำระเงินนี้ว่าถูกต้อง?')) {
                                                                                        const res = await approveInstallmentAction(chatId, idx);
                                                                                        if (res.success) toast({ title: 'อนุมัติเรียบร้อย' });
                                                                                    }
                                                                                }}
                                                                            >
                                                                                อนุมัติ
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                        </div>
                                    </div>
                                )}
                                </div>
                            )}

                            {/* Integrated Vault Section inside Details tab */}
                                        <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                                            
                                            {/* Official Document Card (Unified) */}
                                            {isOfficial && (
                                                <div className="px-1">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">เอกสารสัญญาจ้าง</p>
                                                    <button onClick={() => setShowContractModal(true)} className="w-full p-3 rounded-2xl bg-gradient-to-r from-blue-50 to-white dark:from-slate-800 dark:to-slate-800 border border-blue-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer text-left space-y-2">
                                                        <div className="flex justify-between items-center w-full">
                                                            <span className="text-[11px] font-bold truncate flex-1 mr-2">📄 {caseTitle || 'สัญญาจ้างทนายความ'}</span>
                                                            <Badge className="text-[9px] bg-blue-100 text-blue-700 border-none flex-shrink-0">{contracts.some((c: any) => c.status === 'signed') ? 'เซ็นแล้ว' : 'รอลงนาม'}</Badge>
                                                        </div>
                                                        {installments && installments.length > 0 && (
                                                            <div className="space-y-1.5">
                                                                <div className="flex justify-between text-[10px]">
                                                                    <span className="text-slate-500">ชำระแล้ว {installments.filter((i: any) => i.status === 'paid').length}/{installments.length} งวด</span>
                                                                    <span className="font-bold text-blue-600">฿{totalPaid.toLocaleString()} / ฿{chatAmount.toLocaleString()}</span>
                                                                </div>
                                                                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all" style={{ width: `${Math.min(100, (totalPaid / (chatAmount || 1)) * 100)}%` }} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                            <CardFooter className="flex-col gap-2 pt-2">
                                {/* Aggressive hide: if installments exist, don't show Propose Price button */}
                                {!isCompleted && !isOfficial && (!installments || installments.length === 0) && (
                                    <Button 
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-xs h-10 font-bold rounded-2xl shadow-lg shadow-blue-500/20" 
                                        disabled={isUploading}
                                        onClick={() => router.push(`/lawyer-dashboard/pipeline/new?chatId=${chatId}&clientId=${clientId || client?.id}`)}
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> เสนอราคาเปิดคดี
                                    </Button>
                                )}
                                
                                {!isCompleted && (
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
                                )}
                            </CardFooter>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {(caseTitle || description || chatAmount > 0) && (
                                <Card className="border-none bg-white dark:bg-slate-900/50 rounded-[2rem] overflow-hidden">
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
                                                                    <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
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
                                    
                                    {/* Client Sidebar: Official Documents (Rich Cards) */}
                                    <div className="px-6 pb-6 pt-2 border-t border-slate-100 space-y-4">
                                        {isOfficial && (
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-black uppercase text-blue-600">เอกสารสัญญาจ้าง</p>
                                                <button onClick={() => setShowContractModal(true)} className="w-full p-3 rounded-xl bg-gradient-to-r from-blue-50 to-white border border-blue-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer text-left space-y-2">
                                                    <div className="flex justify-between items-center w-full">
                                                        <span className="text-[10px] font-bold truncate flex-1 mr-1">📄 {caseTitle || 'สัญญาจ้างทนายความ'}</span>
                                                        <Badge className="text-[8px] bg-blue-100 text-blue-700 h-4 px-1 flex-shrink-0">{contracts.some((c: any) => c.status === 'signed') ? 'เซ็นแล้ว' : 'รอลงนาม'}</Badge>
                                                    </div>
                                                    {installments && installments.length > 0 && (
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-[9px]">
                                                                <span className="text-slate-500">ชำระแล้ว {installments.filter((i: any) => i.status === 'paid').length}/{installments.length} งวด</span>
                                                                <span className="font-bold text-blue-600">฿{totalPaid.toLocaleString()}</span>
                                                            </div>
                                                            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                                                                <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full" style={{ width: `${Math.min(100, (totalPaid / (chatAmount || 1)) * 100)}%` }} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {isOfficial && (
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
                            
                        {/* Financial Summary Card */}
                        <Card className="border-none bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-[2rem] overflow-hidden shadow-lg">
                            <CardHeader className="pb-2 border-b border-white/10">
                                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 opacity-80">
                                    <DollarSign className="w-3.5 h-3.5" /> สรุปการชำระเงิน
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ยอดรวมทั้งหมด</p>
                                        <p className="text-2xl font-black">฿{chatAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ชำระแล้ว</p>
                                        <p className="text-xl font-black text-emerald-400">฿{totalPaid.toLocaleString()}</p>
                                    </div>
                                </div>
                                
                                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full transition-all duration-1000" 
                                        style={{ width: `${Math.min(100, (totalPaid / (chatAmount || 1)) * 100)}%` }}
                                    />
                                </div>

                                {chatAmount > totalPaid && (
                                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">ยอดค้างชำระ</span>
                                        <span className="text-sm font-black text-amber-400">฿{(chatAmount - totalPaid).toLocaleString()}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-none bg-white dark:bg-slate-900/50 rounded-[2rem] overflow-hidden shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-white">
                                    <UserIcon className="w-4 h-4 text-blue-500" />
                                    โปรไฟล์ทนาย
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
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
                                                            {isNextToPay && !effectiveIsLawyerView && (
                                                                <Button size="sm" className="h-7 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-[10px] font-bold px-3 transition-colors shadow-md shadow-blue-500/20 whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0 text-white" asChild>
                                                                    <Link href={`/payment?chatId=${chatId}&lawyerId=${resolvedLawyerId}&amount=${instAmount}&type=installment&installmentIndex=${idx}`}>
                                                                        ชำระงวดนี้ <ArrowRight className="ml-1 w-3 h-3" />
                                                                    </Link>
                                                                </Button>
                                                            )}
                                                            {isNextToPay && effectiveIsLawyerView && (
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline"
                                                                    className="h-7 rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50 text-[10px] font-bold px-3 transition-colors flex-shrink-0"
                                                                    onClick={() => requestFeeAction({
                                                                        chatId,
                                                                        lawyerId: resolvedLawyerId!,
                                                                        lawyerName: lawyer?.name || 'ทนายความ',
                                                                        amount: instAmount,
                                                                        reason: `ชำระเงินงวดที่ ${idx + 1}: ${inst.description}`
                                                                    }).then(res => {
                                                                        if (res.success) toast({ title: "ส่งคำขอชำระเงินแล้ว", description: `ส่งคำขอชำระเงินงวดที่ ${idx + 1} ไปยังลูกความแล้ว` });
                                                                    })}
                                                                >
                                                                    <DollarSign className="mr-1 w-3 h-3" /> ส่งคำขอชำระเงิน
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
                                        <Link href={`/payment?chatId=${chatId}&lawyerId=${lawyerId}&amount=${chatAmount}&type=case`}>
                                            ชำระเงินเพื่อเปิดคดี ฿{chatAmount.toLocaleString()}
                                        </Link>
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ) : null}
                </TabsContent>

                <TabsContent value="vault" className="mt-0 relative z-10">
                    <div className="space-y-6">
                        <Card className="border-none bg-white dark:bg-slate-900/50 rounded-[2rem] overflow-hidden shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-white">
                                    <FileText className="w-4 h-4 text-blue-500" />
                                    คลังเอกสาร
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Standard Files Section */}
                                <div className="space-y-4">
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                                        <FileText className="w-4 h-4" /> ไฟล์ที่อัปโหลด
                                    </h3>
                                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                                        {files.length === 0 ? (
                                            <div className="py-12 text-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                                                <p className="text-slate-400 text-xs uppercase tracking-widest font-medium">ยังไม่มีไฟล์ที่อัปโหลด</p>
                                            </div>
                                        ) : (
                                            files.map((file, idx) => {
                                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
                                                return (
                                                <div key={idx} className="flex justify-between items-center p-4 rounded-2xl bg-white border border-slate-100 shadow-sm group hover:shadow-md transition-all">
                                                    <button 
                                                        onClick={() => handleViewFile(file.url, file.name)} 
                                                        className="flex items-center gap-3 overflow-hidden flex-1 text-left"
                                                    >
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                                                            isImage 
                                                                ? "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white" 
                                                                : "bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white"
                                                        )}>
                                                            {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={cn(
                                                                "text-sm font-bold truncate transition-colors text-slate-800",
                                                                isImage ? "group-hover:text-purple-700" : "group-hover:text-red-700"
                                                            )} title={file.name}>{file.name}</p>
                                                            <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                        </div>
                                                    </button>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-10 w-10 rounded-xl text-slate-300 hover:text-red-600 hover:bg-red-50"
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
                                                        <Trash2 className="w-5 h-5" />
                                                    </Button>
                                                </div>
                                            )})
                                        )}
                                    </div>
                                </div>

                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                <Button 
                                    onClick={handleUploadClick} 
                                    variant="outline" 
                                    className="w-full text-sm h-14 border-dashed rounded-[2rem] bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300 transition-all border-slate-200 text-slate-600 font-bold" 
                                    disabled={isChatDisabled}
                                >
                                    <Plus className="mr-2 h-5 w-5" /> อัปโหลดใหม่
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );

    return (
        <>
        <div className="bg-slate-50 dark:bg-slate-950 h-dvh md:h-[calc(100dvh-80px)] overflow-hidden">
            <div className="max-w-6xl mx-auto h-full flex md:gap-6 relative overflow-x-hidden px-0 md:px-6">
                {isAdminView && !isUserLawyer && (user?.uid !== client?.id) && (
                    <div className="absolute top-0 left-0 right-0 z-[60] bg-amber-600 text-white text-[10px] md:text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-md animate-in fade-in slide-in-from-top duration-500">
                        <ShieldAlert className="w-3 h-3 md:w-4 md:h-4" />
                        คุณกำลังเข้าชมห้องแชทนี้ในฐานะผู้ดูแลระบบ (Admin View Mode)
                    </div>
                )}

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    <ChatBox 
                        chatId={chatId} 
                        currentUser={user} 
                        otherUser={otherUser}
                        isDisabled={isChatDisabled}
                        isLawyerView={effectiveIsLawyerView}
                        firestore={firestore}
                        isUploading={isUploading}
                        onFileUpload={executeFileUpload}
                        onBack={() => router.push(effectiveIsLawyerView ? "/lawyer-dashboard" : "/dashboard")}
                        actions={(
                            <>
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button size="sm" className="h-8 px-4 text-[10px] font-black bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center gap-1.5 shadow-lg shadow-blue-500/20 border-none transition-all hover:scale-105 active:scale-95">
                                            <Info className="h-3.5 w-3.5" />
                                            <span>จัดการ</span>
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent side="right" className="w-[90vw] sm:w-[450px] p-0 border-l-0">
                                        <SheetHeader className="sr-only">
                                            <SheetTitle>จัดการคดี</SheetTitle>
                                        </SheetHeader>
                                        <div className="h-full overflow-y-auto custom-scrollbar p-6">
                                            <CaseDetailsContent />
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </>
                        )}
                    />
                </div>

                {/* Right Sidebar - Case Details (Desktop) */}
                <div className="hidden lg:flex w-[380px] flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800 overflow-hidden h-full">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        <CaseDetailsContent />
                    </div>
                </div>
            </div>            {/* Image Preview Modal */}
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
                            <Button 
                                size="sm" 
                                variant="outline" 
                                className="rounded-full text-xs h-8" 
                                onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = previewFile?.url || '';
                                    link.target = '_blank';
                                    link.click();
                                }}
                            >
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Full screen
                            </Button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 bg-slate-900 flex items-center justify-center overflow-hidden">
                        {previewFile?.url && (
                            previewFile.type === 'pdf' ? (
                                <div className="w-full h-full relative">
                                    <embed 
                                        src={previewFile.url} 
                                        type="application/pdf"
                                        className="w-full h-full border-none" 
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="p-6 bg-slate-800/80 backdrop-blur-md rounded-2xl text-center pointer-events-auto">
                                            <p className="text-white text-sm font-bold mb-4">หากเอกสารไม่แสดงผล</p>
                                            <Button 
                                                onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = previewFile.url;
                                                    link.target = '_blank';
                                                    link.click();
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-xs"
                                            >
                                                เปิดไฟล์ในแท็บใหม่
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <img 
                                    src={previewFile.url} 
                                    alt={previewFile.name} 
                                    className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300"
                                />
                            )
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Contract Modal — Capdeal Style */}
            <Dialog open={showContractModal} onOpenChange={setShowContractModal}>
                <DialogContent className="max-w-6xl w-[95vw] h-[90vh] overflow-hidden rounded-xl p-0 bg-slate-50 dark:bg-slate-900 border-none shadow-2xl flex flex-col">
                    <DialogTitle className="sr-only">เอกสารสัญญาจ้าง</DialogTitle>
                    
                    {/* Top Bar */}
                    <div className="flex-none p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex justify-between items-center z-10 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-lg">
                                <FileSignature className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white">สัญญา</h2>
                                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", contracts.some((c: any) => c.status === 'signed') ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                        {contracts.some((c: any) => c.status === 'signed') ? "เสร็จสิ้น (Completed)" : "รอการเซ็น (Pending)"}
                                    </span>
                                </div>
                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">เลขที่สัญญา: #{contracts[0]?.id?.substring(0, 8) || chatId?.substring(0,8) || '...'}</p>
                            </div>
                        </div>
                        <div className="hidden md:flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-9 rounded-full text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => {
                                if (contracts[0]?.id) {
                                    navigator.clipboard.writeText(`${window.location.origin}/contract/${contracts[0].id}/print`);
                                    toast({ title: 'คัดลอกลิงก์สำเร็จ', description: 'คุณสามารถนำลิงก์นี้ไปส่งให้คู่สัญญาได้เลย' });
                                } else {
                                    toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: 'ยังไม่มีเอกสารสัญญาสมบูรณ์' });
                                }
                            }}>
                                <ExternalLink className="w-4 h-4 mr-1.5" /> แชร์สัญญานี้
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 rounded-full text-xs font-bold text-amber-600 border-amber-200 hover:bg-amber-50">
                                <Plus className="w-4 h-4 mr-1.5" /> สร้างฉบับแก้ไข
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 rounded-full text-xs font-bold" asChild>
                                {contracts[0]?.id ? (
                                    <a href={`/contract/${contracts[0].id}/print`} target="_blank" rel="noopener noreferrer">
                                        <Maximize2 className="w-4 h-4 mr-1.5" /> ดูสัญญาเต็มแผ่น
                                    </a>
                                ) : (
                                    <button onClick={() => toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: 'ยังไม่มีเอกสารสัญญาสมบูรณ์' })}>
                                        <Maximize2 className="w-4 h-4 mr-1.5" /> ดูสัญญาเต็มแผ่น
                                    </button>
                                )}
                            </Button>
                            <Button size="sm" className="h-9 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white" asChild>
                                {contracts[0]?.id ? (
                                    <a href={`/contract/${contracts[0].id}/print?print=1`} target="_blank" rel="noopener noreferrer">
                                        <FileDown className="w-4 h-4 mr-1.5" /> PDF
                                    </a>
                                ) : (
                                    <button onClick={() => toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: 'ยังไม่มีเอกสารสัญญาสมบูรณ์' })}>
                                        <FileDown className="w-4 h-4 mr-1.5" /> PDF
                                    </button>
                                )}
                            </Button>
                        </div>
                        <div className="md:hidden">
                            <Button variant="ghost" size="icon" onClick={() => setShowContractModal(false)}><ChevronLeft className="w-6 h-6"/></Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto flex flex-col md:flex-row gap-6 p-4 md:p-8 bg-slate-100 dark:bg-slate-900/50">
                        {/* Left: A4 Document Area */}
                        <div className="flex-1 flex justify-center pb-8">
                            <div className="bg-white dark:bg-slate-950 w-full max-w-[210mm] min-h-[297mm] shadow-xl p-8 md:p-16 flex flex-col relative h-max">
                                {/* Watermark */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none z-0">
                                    <FileSignature className="w-96 h-96" />
                                </div>

                                <div className="relative z-10 flex-1 flex flex-col">
                                    <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-2">สัญญา</h1>
                                    <p className="text-center text-sm text-slate-500 mb-8">(ฉบับย่อ)</p>

                                    <div className="space-y-1 mb-8 text-sm md:text-base text-right">
                                        <p>ทำที่ <span className="border-b border-dotted border-slate-400 pb-0.5 px-4 font-medium inline-block min-w-[200px] text-center">ข้อตกลงออนไลน์</span></p>
                                        <p>วันที่ <span className="border-b border-dotted border-slate-400 pb-0.5 px-4 font-medium inline-block min-w-[200px] text-center">
                                            {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span></p>
                                    </div>

                                    <div className="space-y-6 text-sm md:text-base leading-loose text-slate-800 dark:text-slate-300">
                                        <p className="indent-12 text-justify">
                                            สัญญาฉบับนี้ทำขึ้นระหว่าง <span className="font-bold border-b border-dotted border-slate-400 pb-0.5 px-4">{client?.name || 'ลูกความ'}</span>
                                            บัตรประจำตัวประชาชนเลขที่ <span className="inline-block border-b border-dotted border-slate-400 pb-0.5 px-4 min-w-[150px] text-center">{clientInfo?.taxId || ''}</span> 
                                            ตั้งอยู่หรืออาศัยอยู่เลขที่ <span className="inline-block border-b border-dotted border-slate-400 pb-0.5 px-4 min-w-[200px] text-center">{clientInfo?.address || ''}</span> 
                                            ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>"คู่สัญญาฝ่ายที่หนึ่ง"</strong> ฝ่ายหนึ่ง
                                        </p>

                                        <p className="indent-12 text-justify">
                                            กับ <span className="font-bold border-b border-dotted border-slate-400 pb-0.5 px-4">{lawyer?.name || 'ทนายความ'}</span> 
                                            บัตรประจำตัวประชาชนเลขที่ <span className="inline-block border-b border-dotted border-slate-400 pb-0.5 px-4 min-w-[150px] text-center"></span> 
                                            ตั้งอยู่หรืออาศัยอยู่เลขที่ <span className="inline-block border-b border-dotted border-slate-400 pb-0.5 px-4 min-w-[200px] text-center"></span> 
                                            ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>"คู่สัญญาฝ่ายที่สอง"</strong> อีกฝ่ายหนึ่ง
                                        </p>

                                        <p className="indent-12 text-justify">
                                            คู่สัญญาทั้งสองฝ่ายตกลงทำสัญญาฉบับนี้โดยมีข้อความดังต่อไปนี้:
                                        </p>

                                        <div className="pl-4 md:pl-12 space-y-4">
                                            <div>
                                                <p className="font-bold">ข้อ 1. ขอบเขตของงาน (Scope of Work)</p>
                                                <p className="pl-6 pt-2 leading-relaxed whitespace-pre-wrap">{description || caseTitle || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="font-bold">ข้อ 2. ค่าจ้างและเงื่อนไขการชำระเงิน</p>
                                                <p className="pl-6 pt-2">
                                                    ผู้ว่าจ้างตกลงชำระค่าจ้างทั้งสิ้น <strong className="text-blue-600">฿{(chatAmount || 0).toLocaleString()}</strong> บาท
                                                </p>
                                                
                                                {installments && installments.length > 0 && (
                                                    <div className="mt-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                                        <p className="font-bold mb-2">แผนการชำระเงิน ({installments.length} งวด)</p>
                                                        <div className="space-y-2">
                                                            {installments.map((inst: any, idx: number) => {
                                                                const amt = parseFloat(String(inst.amount || 0).replace(/,/g, ''));
                                                                return (
                                                                    <div key={idx} className="flex justify-between items-center text-sm pb-2 border-b border-slate-200 dark:border-slate-800 last:border-0 last:pb-0">
                                                                        <span>งวดที่ {idx + 1}: {inst.description}</span>
                                                                        <span className="font-bold text-blue-600">฿{isNaN(amt) ? 0 : amt.toLocaleString()}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <p className="indent-12 text-justify mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                                            สัญญานี้เป็นการสรุปข้อตกลงเบื้องต้นจากการเจรจาผ่านทางแชท คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงได้ลงลายมือชื่อผ่านระบบอิเล็กทรอนิกส์ไว้เป็นสำคัญ
                                        </p>
                                    </div>

                                    <div className="mt-12 pt-8 flex justify-around">
                                        <div className="text-center space-y-2 flex flex-col items-center">
                                            <div className="h-16 w-40 flex items-center justify-center border-b border-dotted border-slate-400 mb-2">
                                                {contracts.some((c: any) => c.clientSigned) ? (
                                                    contracts[0]?.clientSignatureImage ? (
                                                        <div className="relative w-full h-full flex items-center justify-center">
                                                            <img src={contracts[0].clientSignatureImage} alt="Client Signature" className="max-h-full max-w-full object-contain mix-blend-multiply opacity-80" />
                                                            <div className="absolute -bottom-2 right-0 text-[8px] text-emerald-600 font-bold bg-white/80 px-1 rounded">✔ ลงนามแล้ว</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-emerald-600 font-bold italic">ลงนามผ่านระบบแล้ว</span>
                                                    )
                                                ) : !effectiveIsLawyerView ? (
                                                    <button onClick={() => { 
                                                        setSigningRole('client');
                                                        setShowSignaturePad(true);
                                                    }} className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer group">
                                                        <FileSignature className="w-6 h-6 md:w-8 md:h-8 group-hover:scale-110 transition-transform" />
                                                        <span className="text-[10px] md:text-xs font-medium">คลิกเพื่อเซ็นชื่อ</span>
                                                    </button>
                                                ) : (<span className="text-[10px] text-slate-300 italic">รอลงนาม</span>)}
                                            </div>
                                            <p className="font-bold text-sm">ผู้ว่าจ้าง</p>
                                            <p className="text-xs text-slate-500">( {client?.name || 'ลูกความ'} )</p>
                                        </div>
                                        <div className="text-center space-y-2 flex flex-col items-center">
                                            <div className="h-16 w-40 flex items-center justify-center border-b border-dotted border-slate-400 mb-2">
                                                {contracts.some((c: any) => c.lawyerSigned) ? (
                                                    contracts[0]?.lawyerSignatureImage ? (
                                                        <div className="relative w-full h-full flex items-center justify-center">
                                                            <img src={contracts[0].lawyerSignatureImage} alt="Lawyer Signature" className="max-h-full max-w-full object-contain mix-blend-multiply opacity-80" />
                                                            <div className="absolute -bottom-2 right-0 text-[8px] text-emerald-600 font-bold bg-white/80 px-1 rounded">✔ ลงนามแล้ว</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-emerald-600 font-bold italic">ลงนามผ่านระบบแล้ว</span>
                                                    )
                                                ) : effectiveIsLawyerView ? (
                                                    <button onClick={() => { 
                                                        setSigningRole('lawyer');
                                                        setShowSignaturePad(true);
                                                    }} className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer group">
                                                        <FileSignature className="w-6 h-6 md:w-8 md:h-8 group-hover:scale-110 transition-transform" />
                                                        <span className="text-[10px] md:text-xs font-medium">คลิกเพื่อเซ็นชื่อ</span>
                                                    </button>
                                                ) : (<span className="text-[10px] text-slate-300 italic">รอลงนาม</span>)}
                                            </div>
                                            <p className="font-bold text-sm">คู่สัญญาฝ่ายที่สอง</p>
                                            <p className="text-xs text-slate-500">( {lawyer?.name || 'ทนายความ'} )</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Sidebar */}
                        <div className="w-full md:w-[320px] flex flex-col gap-4 flex-shrink-0">
                            <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                    <p className="text-xs font-bold text-slate-500">คู่สัญญาฝ่ายที่หนึ่ง (PARTY A)</p>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 bg-slate-100">
                                            <AvatarFallback className="text-slate-500">{client?.name?.charAt(0) || 'C'}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-bold text-sm">{client?.name || 'ลูกความ'}</p>
                                            <p className="text-[10px] text-slate-400">{client?.email || 'ไม่ระบุอีเมล'}</p>
                                        </div>
                                    </div>
                                    {contracts.some((c: any) => c.clientSigned) ? (
                                        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                                            <CheckCircle2 className="w-4 h-4" /> ลงนามเรียบร้อยแล้ว
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-amber-600 text-xs font-bold">
                                            <AlertTriangle className="w-4 h-4" /> รอการลงนาม
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                    <p className="text-xs font-bold text-slate-500">คู่สัญญาฝ่ายที่สอง (PARTY B)</p>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 bg-slate-100">
                                            <AvatarFallback className="text-slate-500">{lawyer?.name?.charAt(0) || 'L'}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-bold text-sm">{lawyer?.name || 'ทนายความ'}</p>
                                            <p className="text-[10px] text-slate-400">{lawyer?.email || 'ไม่ระบุอีเมล'}</p>
                                        </div>
                                    </div>
                                    {contracts.some((c: any) => c.lawyerSigned) ? (
                                        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                                            <CheckCircle2 className="w-4 h-4" /> ลงนามเรียบร้อยแล้ว
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-amber-600 text-xs font-bold">
                                            <AlertTriangle className="w-4 h-4" /> รอการลงนาม
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-blue-600 rounded-xl p-5 text-white">
                                <div className="flex items-center gap-2 font-bold mb-2">
                                    <ShieldAlert className="w-5 h-5" /> ปลอดภัยและถูกกฎหมาย
                                </div>
                                <p className="text-[11px] opacity-90 leading-relaxed mb-4">
                                    สัญญานี้มีผลผูกพันทางกฎหมายตาม พ.ร.บ. ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ ข้อมูลทั้งหมดถูกจัดเก็บอย่างปลอดภัย
                                </p>
                                <Button variant="outline" size="sm" className="w-full text-xs font-bold bg-white/10 hover:bg-white/20 border-white/20 text-white">
                                    เรียนรู้เพิ่มเติมเกี่ยวกับ e-Signature
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {showSignaturePad && (
                <Dialog open={showSignaturePad} onOpenChange={setShowSignaturePad}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogTitle className="sr-only">เซ็นชื่อกำกับสัญญา</DialogTitle>
                        <div className="flex flex-col space-y-4 pt-4">
                            <h2 className="text-xl font-bold text-center">เซ็นชื่อกำกับสัญญา</h2>
                            <p className="text-sm text-slate-500 text-center">กรุณาวาดลายเซ็นของคุณในกรอบด้านล่าง</p>
                            <SignaturePad 
                                onSave={async (dataUrl) => {
                                    if (!signingRole) return;
                                    const res = await signContractAction(chatId, signingRole, dataUrl);
                                    if (res.success) {
                                        toast({ title: 'ลงนามสำเร็จ' });
                                        setShowSignaturePad(false);
                                        setShowContractModal(false);
                                        fetchDocsRef.current();
                                    } else {
                                        toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: res.error });
                                    }
                                }} 
                                onCancel={() => setShowSignaturePad(false)} 
                            />
                            <Button variant="outline" onClick={() => setShowSignaturePad(false)}>
                                ยกเลิก
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
        </>
    );
}

export default function ChatPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
            <ChatPageContent />
        </Suspense>
    );
}
