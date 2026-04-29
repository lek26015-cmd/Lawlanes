'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  doc,
  getDoc,
  onSnapshot,
  Firestore,
  serverTimestamp,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { 
  markChatAsReadAction 
} from '@/app/actions/chat-actions';
import type { HumanChatMessage } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Sparkles, Languages, AlertTriangle, RefreshCcw, Check, CheckCheck, CreditCard, ImageIcon, FileIcon, Maximize2, ExternalLink, Plus, Paperclip, ChevronLeft, FileSignature, FileDown, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getCloudflareVariantUrl } from '@/lib/cloudflare-images';
import { useChat } from '@/context/chat-context';
import { translateToMultipleLanguages } from '@/app/actions/translate';
import { QuickReplies } from './quick-replies';
import { CopyButton } from '@/components/ui/copy-button';
import { useChatSocket } from '@/hooks/use-chat-socket';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getSecureDownloadUrl } from '@/app/actions/secure-view';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";

interface ChatBoxProps {
  firestore: Firestore;
  currentUser: User;
  otherUser: { name: string, userId: string, imageUrl: string };
  chatId: string;
  isDisabled?: boolean;
  isLawyerView?: boolean;
  isUploading?: boolean;
  onFileUpload?: (file: File) => void;
  actions?: React.ReactNode;
  onBack?: () => void;
  showBackOnMobile?: boolean;
}

interface MessageWithStatus extends HumanChatMessage {
  translation?: string;
  isTranslating?: boolean;
  _optimisticText?: string; // Original text tag for cleanup matching
}

function ChatBoxContent({
  firestore,
  currentUser,
  otherUser,
  chatId,
  isDisabled = false,
  isLawyerView = false,
  isUploading = false,
  onFileUpload,
  actions,
  onBack,
  showBackOnMobile = true
}: ChatBoxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { 
    messages: socketMessages, 
    isConnected, 
    isLoading: isSocketLoading, 
    isPartnerTyping,
    sendMessage,
    sendTypingEvent 
  } = useChatSocket(chatId, currentUser.uid, currentUser.displayName || 'คู่สนทนา');

  const [messages, setMessages] = useState<MessageWithStatus[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<MessageWithStatus[]>([]);
  const [input, setInput] = useState('');
  const [chatMetadata, setChatMetadata] = useState<any>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string, name: string, type: 'image' | 'pdf' | 'other' } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [contractPreviewData, setContractPreviewData] = useState<any>(null);
  const [isContractPreviewOpen, setIsContractPreviewOpen] = useState(false);
  const [invoicePreviewData, setInvoicePreviewData] = useState<any>(null);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { initialChatMessage, setInitialChatMessage } = useChat();

  // 1. Presence Logic
  useEffect(() => {
    if (!chatId || !firestore || !currentUser) return;
    const updatePresence = async () => {
      try {
        const { markChatAsReadAction } = await import('@/app/actions/chat-actions');
        await markChatAsReadAction(chatId, isLawyerView);
      } catch (err) {
        console.warn("Presence update failed:", err);
      }
    };
    updatePresence();
    const interval = setInterval(updatePresence, 30 * 1000);
    return () => clearInterval(interval);
  }, [chatId, firestore, currentUser, isLawyerView]);

  // 2. Draft Persistence (localStorage)
  useEffect(() => {
    const draft = localStorage.getItem(`chat_draft_${chatId}`);
    if (draft) setInput(draft);
  }, [chatId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    localStorage.setItem(`chat_draft_${chatId}`, val);
    
    // Typing Indicator
    sendTypingEvent(val.length > 0);
  };

  // 3. Metadata listener (Read statuses, Title etc)
  useEffect(() => {
    if (!chatId || !firestore) return;
    const chatRef = doc(firestore, 'chats', chatId);
    const unsubscribe = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) setChatMetadata(snap.data());
    });
    return () => unsubscribe();
  }, [chatId, firestore]);

  // 4. Sync Messages with Socket
  useEffect(() => {
    setMessages(socketMessages.map(msg => ({
      ...msg,
      translation: (messages.find(m => m.id === msg.id) as any)?.translation,
      isTranslating: (messages.find(m => m.id === msg.id) as any)?.isTranslating,
    })));
    
    if (socketMessages.length > 0) {
       const socketTexts = new Set(socketMessages.map(m => m.text));
       setOptimisticMessages(prev => prev.filter(m => !socketTexts.has(m._optimisticText ?? m.text)));
    }
  }, [socketMessages]);

  const handleViewContract = async (contractId: string) => {
    try {
      const docRef = doc(firestore, 'contracts', contractId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setContractPreviewData({ id: contractId, ...docSnap.data() });
        setIsContractPreviewOpen(true);
      } else {
        toast({ variant: "destructive", title: 'ไม่พบสัญญา', description: 'ไม่พบข้อมูลสัญญานี้ในระบบ หรือคุณไม่มีสิทธิ์เข้าถึง' });
      }
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: 'เกิดข้อผิดพลาด', description: e.message || 'ไม่สามารถดึงข้อมูลสัญญาได้' });
    }
  };

  const handleViewInvoice = async (invoiceId: string) => {
    try {
      const docRef = doc(firestore, 'invoices', invoiceId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInvoicePreviewData({ id: invoiceId, ...docSnap.data() });
        setIsInvoicePreviewOpen(true);
      } else {
        toast({ variant: "destructive", title: 'ไม่พบใบเสนอราคา', description: 'ไม่พบข้อมูลนี้ในระบบ หรือคุณไม่มีสิทธิ์เข้าถึง' });
      }
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: 'เกิดข้อผิดพลาด', description: e.message || 'ไม่สามารถดึงข้อมูลใบเสนอราคาได้' });
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isDisabled) return;

    const messageText = input;
    const tempId = `temp-${Date.now()}`;
    
    // 1. Add Optimistic Message
    const optMsg: MessageWithStatus = {
      id: tempId,
      text: messageText,
      senderId: currentUser.uid,
      timestamp: Date.now(),
      status: 'sending',
      _optimisticText: messageText, // Tag for reliable cleanup matching
    };
    setOptimisticMessages(prev => [...prev, optMsg]);
    setInput('');
    localStorage.removeItem(`chat_draft_${chatId}`);
    sendTypingEvent(false);

    try {
      await sendMessage(messageText, otherUser.userId, isLawyerView);
      // Success will be handled by socketMessages update clearing the optimistic list
    } catch (error) {
      console.error("Message send failed:", error);
      setOptimisticMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
    }
  };

  const retryMessage = async (msg: MessageWithStatus) => {
     setOptimisticMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sending' } : m));
     try {
       await sendMessage(msg.text, otherUser.userId, isLawyerView);
     } catch (e) {
       setOptimisticMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'error' } : m));
     }
  };

  const handleTranslateMessage = async (messageId: string, text: string) => {
    setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, isTranslating: true } : msg));
    try {
      const result = await translateToMultipleLanguages(text);
      setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, translation: result.english, isTranslating: false } : msg));
    } catch (error) {
      setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, isTranslating: false } : msg));
    }
  };
  
  const handleFileClick = async (message: HumanChatMessage) => {
    const text = message.text;
    const cleanFileName = (message.metadata?.fileName || text.replace('[อัปโหลดไฟล์]', '').trim()).trim().toLowerCase();
    
    // Attempt to find file in metadata or chat document
    let filePath = message.metadata?.fileUrl;
    let fileName = message.metadata?.fileName || text.replace('[อัปโหลดไฟล์]', '').trim();
    
    if (!filePath && chatMetadata?.files) {
      const fileEntry = chatMetadata.files.find((f: any) => 
        f.name.trim().toLowerCase() === cleanFileName || 
        cleanFileName.includes(f.name.trim().toLowerCase()) ||
        f.name.trim().toLowerCase().includes(cleanFileName)
      );
      if (fileEntry) {
        filePath = fileEntry.url;
        fileName = fileEntry.name;
      }
    }
    
    if (!filePath) {
      console.warn("File path not found for:", fileName, "Attempting server discovery...");
      toast({ title: "กำลังค้นหาไฟล์ในระบบสำรอง...", description: "โปรดรอสักครู่ ระบบกำลังกู้คืนข้อมูลไฟล์" });
      
      const { discoverFilePathAction } = await import('@/app/actions/discover-file');
      const msgTimestamp = typeof message.timestamp === 'number' ? message.timestamp : 
                          (message.timestamp?.toDate ? message.timestamp.toDate().getTime() : Date.now());
      
      const discoveryResult = await discoverFilePathAction(chatId, fileName, msgTimestamp);
      
      if (discoveryResult.success && discoveryResult.filePath) {
        filePath = discoveryResult.filePath;
        toast({ title: "กู้คืนไฟล์สำเร็จ", description: "ระบบพบตำแหน่งไฟล์แล้ว กำลังเปิดเอกสาร..." });
      } else {
        console.warn("Discovery failed:", discoveryResult.error, "Debug:", discoveryResult.debug);
        const availableFiles = chatMetadata?.files?.map((f: any) => f.name).join(', ') || 'ไม่มีไฟล์ในรายการ';
        const metadataInfo = message.metadata ? JSON.stringify(message.metadata) : 'ไม่มี Metadata';
        const storageDebug = discoveryResult.debug ? `\nStorage: ${discoveryResult.debug.filesCount} files (${discoveryResult.debug.filesList.join(', ')})` : '';
        
        toast({ 
          variant: "destructive", 
          title: "ไม่พบข้อมูลไฟล์", 
          description: `ไม่พบ "${fileName}" ในระบบแชท\nไฟล์ที่มี: ${availableFiles}\nMetadata: ${metadataInfo}${storageDebug}` 
        });
        return;
      }
    }

    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
    const isPDF = /\.pdf$/i.test(fileName);
    
    try {
      toast({ title: "กำลังเตรียมไฟล์...", description: `กำลังดึงข้อมูลสำหรับ ${fileName}` });
      
      // For images and PDFs, we want to view them inline in our modal
      if (isImage || isPDF) {
        const url = await getSecureDownloadUrl(filePath, chatId, undefined, 'inline');
        if (!url) {
          toast({ variant: "destructive", title: "ไม่สามารถเปิดไฟล์ได้", description: "ระบบไม่สามารถสร้างลิงก์สำหรับเข้าถึงไฟล์ได้ (ตรวจสอบสิทธิ์หรือเซสชันของคุณ)" });
          return;
        }
        setPreviewFile({ url, name: fileName, type: isImage ? 'image' : 'pdf' });
        setIsPreviewOpen(true);
      } else {
        // For other files (xlsx, docx, etc), we force a download using a hidden link to avoid popup blockers
        const url = await getSecureDownloadUrl(filePath, chatId, undefined, 'attachment');
        if (!url) {
          toast({ variant: "destructive", title: "ไม่สามารถดาวน์โหลดไฟล์ได้", description: "ระบบไม่สามารถสร้างลิงก์สำหรับดาวน์โหลดได้" });
          return;
        }
        
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "กำลังเริ่มดาวน์โหลด", description: `ดาวน์โหลดไฟล์ ${fileName} แล้ว` });
      }
    } catch (err: any) {
      console.error("Failed to view file:", err);
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: err.message || "ไม่สามารถดึงข้อมูลไฟล์ได้ในขณะนี้" });
    }
  };

  useEffect(() => {
    if (initialChatMessage && isConnected) {
      const text = initialChatMessage;
      setInitialChatMessage('');
      setInput(text);
      // Let it flow through normal send flow for optimistic UI
    }
  }, [initialChatMessage, isConnected, setInitialChatMessage]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const diff = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
        if (diff > 500) {
           viewport.scrollTop = viewport.scrollHeight;
        } else {
           viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
        }
      }
    }
  }, [messages, optimisticMessages, isUploading, isPartnerTyping]);

  const allMessages = [...messages, ...optimisticMessages];
  const firstUserMessage = allMessages.find(m => m.senderId !== (isLawyerView ? currentUser.uid : otherUser.userId));

  return (
    <Card className="flex flex-col h-full w-full max-w-full min-w-0 shadow-none border-none md:border md:border-slate-200/60 dark:md:border-slate-800 rounded-none md:rounded-2xl overflow-hidden bg-white dark:bg-slate-900 transition-all duration-500">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md pt-3 pb-2.5 md:py-3.5 px-4 md:px-8 min-w-0 w-full z-20">
        <div className="flex flex-row justify-between items-center gap-1 md:gap-4 min-w-0 w-full">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            {onBack && (
               <Button 
                variant="ghost" 
                size="icon" 
                className="-ml-2 h-9 w-9 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500"
                onClick={onBack}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <Avatar className="h-8 w-8 md:h-10 md:w-10 border-2 border-primary/5 flex-shrink-0 transition-transform hover:scale-105 duration-300">
               <AvatarImage src={getCloudflareVariantUrl(otherUser.imageUrl, 'avatar')} />
               <AvatarFallback className="bg-primary/5 text-primary font-bold text-base md:text-xl">{otherUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 overflow-hidden ml-1 md:ml-2">
              <div className="flex items-center gap-1 md:gap-2">
                <CardTitle className="text-[10px] md:text-[11px] font-black text-blue-600/60 truncate uppercase tracking-[0.2em] block mb-0.5">
                  {(chatMetadata?.caseTitle || chatMetadata?.title || 'กำลังโหลด...').replace(/^Ticket\s+สนทนา:\s*/i, '')}
                </CardTitle>
                {isConnected ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" title="Connected" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" title="Offline" />
                )}
              </div>
              <h2 className="text-sm md:text-lg font-black text-slate-900 dark:text-white truncate leading-none tracking-tight max-w-[180px] md:max-w-none">
                {otherUser.name}
              </h2>
              <div className="flex items-center gap-2 mt-1 md:mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[9px] md:text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest border border-blue-100/50 dark:border-blue-800/50">
                    {isLawyerView ? "ลูกความ" : "ทนายความ"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 md:gap-2 flex-shrink-0">
             {isLawyerView && <QuickReplies onSelect={(text) => { setInput(text); localStorage.setItem(`chat_draft_${chatId}`, text); }} />}
             <CopyButton value={chatId} className="h-7 w-7 md:h-10 md:w-10 rounded-lg md:rounded-2xl" />
             {actions}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-grow p-0 flex flex-col min-h-0 min-w-0 bg-slate-50/30 dark:bg-slate-950/30 overflow-hidden">
        <ScrollArea className="flex-grow w-full min-w-0" viewportClassName="overflow-x-hidden" ref={scrollAreaRef}>
          <div className="space-y-6 md:space-y-8 pl-3 pr-4 py-4 md:pl-8 md:pr-12 md:py-8 w-full max-w-full overflow-x-hidden flex flex-col min-w-0">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl md:rounded-2xl p-3 md:p-4 flex items-start gap-2 md:gap-3 text-amber-900 dark:text-amber-200 text-[10px] md:text-sm max-w-full min-w-0 shadow-sm">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 text-amber-600" />
              <p className="break-words [overflow-wrap:anywhere] [word-break:break-word] min-w-0">ห้ามโอนเงินนอกระบบ Lawlanes เพื่อความปลอดภัยของคุณ</p>
            </div>

            <div className="flex items-start gap-3 md:gap-4 max-w-full min-w-0">
              <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div className="flex-1 min-w-0 max-w-[85%]">
                <div className="p-4 md:p-5 rounded-2xl md:rounded-3xl rounded-tl-sm bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden min-w-0">
                  <p className="font-bold text-[9px] text-primary uppercase tracking-widest mb-1 md:mb-1.5 opacity-70">
                    {isLawyerView ? "AI: สรุปข้อความเบื้องต้น" : "ข้อมูลที่คุณส่งให้ทนาย"}
                  </p>
                  <p className="text-xs md:text-base text-gray-700 dark:text-gray-300 italic leading-relaxed break-words [overflow-wrap:anywhere] [word-break:break-word] min-w-0">
                    {firstUserMessage ? `"${firstUserMessage.text}"` : "กำลังรอข้อมูล..."}
                  </p>
                </div>
              </div>
            </div>

            {allMessages.map((msg, idx) => {
              const isOwn = msg.senderId === currentUser.uid;
              const showAvatar = !isOwn && (idx === 0 || allMessages[idx-1].senderId !== msg.senderId);
              const isLastMsg = idx === allMessages.length - 1;
              const isFileUpload = msg.text.includes('[อัปโหลดไฟล์]');

              return (
                <div key={msg.id} className={cn("flex flex-col w-full max-w-full min-w-0", isOwn ? "items-end" : "items-start")}>
                  <div className={cn("flex items-end gap-2 md:gap-3 max-w-[75%] md:max-w-[75%] min-w-0 w-fit", isOwn ? "flex-row-reverse" : "flex-row")}>
                    {!isOwn && (
                      <div className="w-9 h-9 flex-shrink-0">
                        {showAvatar && (
                          <Avatar className="h-9 w-9 border-2 border-primary/5 shadow-sm flex-shrink-0">
                            <AvatarImage src={getCloudflareVariantUrl(otherUser.imageUrl, 'avatar')} />
                            <AvatarFallback className="bg-primary/5 text-primary font-bold">{otherUser.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )}
                    <div className={cn("flex flex-col min-w-0", isOwn ? "items-end" : "items-start")}>
                      {showAvatar && !isOwn && <span className="text-[10px] font-bold text-muted-foreground/60 ml-2 mb-1.5 truncate max-w-full block uppercase tracking-wider">{otherUser.name}</span>}
                      {(() => {
                        const isPayment = msg.text.includes('💳');
                        const isCapdeal = msg.type === 'capdeal_contract';
                        const isProposal = msg.type === 'case_proposal';
                        return (
                          <div 
                            className={cn(
                              "relative group transition-all duration-300 min-w-0 overflow-hidden",
                              isFileUpload ? "rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:shadow-md" : 
                              isPayment || isCapdeal || isProposal ? "rounded-[2rem] border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 overflow-hidden shadow-lg shadow-blue-500/10" :
                              isOwn 
                                ? "bg-blue-600 text-white rounded-[2rem] rounded-tr-sm shadow-md" 
                                : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-[2rem] rounded-tl-sm shadow-sm",
                              !isFileUpload && "px-4 py-2 md:px-5 md:py-2.5"
                            )}
                            onClick={() => isFileUpload && handleFileClick(msg)}
                          >
                            {isCapdeal ? (
                                <div className="flex flex-col min-w-0">
                                    <div className="p-4 bg-emerald-600 text-white flex items-center gap-3">
                                        <div className="p-2 bg-white/20 rounded-xl">
                                            <FileSignature className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest">Capdeal Contract</span>
                                    </div>
                                    <div className="p-5 bg-white dark:bg-slate-900 space-y-4 min-w-0">
                                        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                                        <div className="flex flex-col gap-2">
                                            <Button 
                                               className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 font-bold rounded-2xl shadow-md text-sm" 
                                               onClick={() => handleViewContract(msg.metadata?.contractId)}
                                            >
                                               📄 เปิดดูรายละเอียดสัญญา
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : isProposal ? (
                                <div className="flex flex-col min-w-0">
                                    <div className="p-4 bg-blue-700 text-white flex items-center gap-3">
                                        <div className="p-2 bg-white/20 rounded-xl">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest">Proposal Document</span>
                                    </div>
                                    <div className="p-5 bg-white dark:bg-slate-900 space-y-4 min-w-0">
                                        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                                        <Button 
                                           className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-bold rounded-2xl shadow-md text-sm" 
                                           onClick={() => handleViewInvoice(msg.metadata?.invoiceId)}
                                        >
                                            📄 เปิดดูรายละเอียดใบเสนอราคา
                                        </Button>>
                                    </div>
                                </div>
                            ) : isPayment ? (
                                <div className="flex flex-col min-w-0">
                                    <div className="p-4 bg-blue-600 text-white flex items-center gap-3">
                                        <div className="p-2 bg-white/20 rounded-xl">
                                            <CreditCard className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest">Payment Request</span>
                                    </div>
                                    <div className="p-5 bg-white dark:bg-slate-900 space-y-4 min-w-0">
                                        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                                        <Button 
                                           className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-bold rounded-2xl shadow-md text-sm" 
                                           asChild
                                        >
                                            <a href={`/payment?chatId=${chatId}&type=${msg.text.includes('ค่าบริการ') ? 'consultation' : 'case'}${msg.metadata?.amount ? `&amount=${msg.metadata.amount}` : ''}`} target="_blank" rel="noopener noreferrer">
                                              💳 ดำเนินการชำระเงิน
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                               isFileUpload ? (
                                 <div className="flex items-center gap-4 p-4 min-w-0 max-w-full overflow-hidden">
                                   <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg flex-shrink-0">
                                     <FileIcon className="w-6 h-6" />
                                   </div>
                                   <div className="flex-1 min-w-0 overflow-hidden">
                                     <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest mb-1">เอกสารใหม่</p>
                                     <p className="text-sm font-bold text-slate-900 dark:text-white break-words [overflow-wrap:anywhere] [word-break:break-all] leading-snug">
                                       {msg.metadata?.fileName || msg.text.replace('[อัปโหลดไฟล์]', '').trim()}
                                     </p>
                                     <div className="flex items-center gap-2 mt-1.5">
                                       <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1 whitespace-nowrap">
                                         <Maximize2 className="w-3.5 h-3.5" /> คลิกเพื่อดูตัวอย่าง
                                       </span>
                                     </div>
                                   </div>
                                 </div>
                               ) : (
                                 <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] overflow-hidden min-w-0">{msg.text}</p>
                               )
                            )}
                          </div>
                        );
                      })()}
                      
                      {msg.status === 'error' && (
                        <button onClick={() => retryMessage(msg)} className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-1.5 hover:underline">
                          <RefreshCcw className="w-3 h-3" /> ส่งไม่สำเร็จ คลิกเพื่อลองใหม่
                        </button>
                      )}

                      {!isOwn && (
                        <button 
                          onClick={() => handleTranslateMessage(msg.id, msg.text)}
                          className="text-[10px] font-bold text-primary/60 hover:text-primary hover:underline flex items-center gap-1.5 mt-1.5 transition-colors"
                        >
                          {msg.isTranslating ? <Loader2 className="w-3 h-3 animate-spin"/> : <Languages className="w-3 h-3"/>}
                          {msg.translation ? 'แปลซ้ำ' : 'แปลภาษา'}
                        </button>
                      )}
                      
                      {msg.translation && !isOwn && (
                        <div className="mt-2 p-3 rounded-2xl bg-primary/5 border border-primary/10 text-[11px] md:text-xs text-primary/80 italic leading-relaxed">
                           {msg.translation}
                        </div>
                      )}
                    </div>
                  </div>
                  {isOwn && isLastMsg && (
                    <div className="mt-1.5 mr-3 flex items-center gap-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                       {isLawyerView ? (
                         chatMetadata?.clientReadAt ? (
                           <span className="text-green-600 flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5"/> อ่านแล้ว</span>
                         ) : <Check className="w-3.5 h-3.5"/>
                       ) : (
                         chatMetadata?.lawyerReadAt ? (
                           <span className="text-green-600 flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5"/> ทนายอ่านแล้ว</span>
                         ) : <Check className="w-3.5 h-3.5"/>
                       )}
                    </div>
                  )}
                </div>
              );
            })}

            {isPartnerTyping && (
              <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground/60 animate-pulse ml-12 uppercase tracking-widest">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
                </div>
                <span className="truncate">{otherUser.name} กำลังพิมพ์...</span>
              </div>
            )}

            {isUploading && (
              <div className="flex items-center gap-3 text-xs font-bold text-blue-600 animate-pulse ml-12 uppercase tracking-widest">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังส่งไฟล์...</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="px-4 py-2 md:px-8 md:py-3 border-t bg-white dark:bg-slate-900 w-full min-w-0">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
          className="flex items-center w-full gap-3 min-w-0"
        >
          <div className="relative flex-grow flex items-center gap-3 min-w-0">
            {!isDisabled && onFileUpload && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      for (let i = 0; i < files.length; i++) {
                        onFileUpload(files[i]);
                      }
                    }
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 h-12 w-12 flex-shrink-0 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isSocketLoading}
                >
                  <Paperclip className="w-6 h-6" />
                </Button>
              </>
            )}
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder={isDisabled ? "การสนทนานี้สิ้นสุดแล้ว" : "พิมพ์ข้อความที่นี่..."}
              disabled={isSocketLoading || isDisabled}
              className="rounded-2xl bg-gray-50 dark:bg-slate-800 border-none h-12 md:h-14 px-6 focus-visible:ring-2 focus-visible:ring-primary shadow-inner w-full min-w-0 text-base"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={isSocketLoading || !input.trim() || isDisabled}
            className="rounded-2xl w-12 h-12 md:w-14 md:h-14 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex-shrink-0"
          >
            <Send className="w-6 h-6" />
          </Button>
        </form>
      </CardFooter>

      {/* Image Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[80vh] flex flex-col p-0 overflow-hidden border-none rounded-3xl">
          <DialogHeader className="p-4 border-b bg-white flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                <ImageIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-bold truncate pr-4">{previewFile?.name}</DialogTitle>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">ตัวอย่างไฟล์</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-8">
              <Button 
                size="sm" 
                variant="outline" 
                className="rounded-full text-xs h-8 flex-shrink-0" 
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
          <div className="flex-1 bg-slate-900 flex items-center justify-center overflow-hidden relative min-h-[300px]">
            {!previewFile?.url ? (
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest">กำลังดึงข้อมูลไฟล์...</p>
              </div>
            ) : previewFile.type === 'pdf' ? (
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 relative">
                  <embed 
                    src={previewFile.url} 
                    type="application/pdf"
                    className="w-full h-full border-none" 
                  />
                  {/* Fallback for browsers that don't support embedded PDFs */}
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
              </div>
            ) : (
              <ImagePreviewContent url={previewFile.url} name={previewFile.name} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Contract Preview Modal */}
      <Dialog open={isContractPreviewOpen} onOpenChange={setIsContractPreviewOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-3xl p-6 bg-white dark:bg-slate-900 border-none shadow-2xl">
            <DialogHeader>
                <DialogTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <FileSignature className="w-5 h-5 text-emerald-600" /> สัญญาจ้างทนายความ
                </DialogTitle>
            </DialogHeader>
            {contractPreviewData && (
                <div className="mt-4 space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-3">
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">เรื่อง / ภาระงาน</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{contractPreviewData.task || contractPreviewData.title}</p>
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-3">
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">ค่าบริการรวม</p>
                                <p className="text-lg font-black text-blue-600">฿{(contractPreviewData.price || contractPreviewData.amount || 0).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">สถานะ</p>
                                <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", contractPreviewData.status === 'signed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                                    {contractPreviewData.status === 'signed' ? 'ลงนามแล้ว' : 'รอการลงนาม'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 leading-relaxed bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                        <p className="font-bold mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-blue-600"/> ข้อตกลงเบื้องต้น</p>
                        สัญญาฉบับนี้เป็นสัญญามาตรฐานของแพลตฟอร์ม Lawslane หากมีข้อกำหนดเพิ่มเติม จะเป็นไปตามที่ตกลงกันในแชท ทั้งนี้การลงนามจะสมบูรณ์เมื่อมีการชำระเงินหรือยืนยันผ่านระบบ Capdeal
                    </div>
                    <Button className="w-full h-11 rounded-2xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" onClick={() => setIsContractPreviewOpen(false)}>
                        ปิดหน้าต่าง
                    </Button>
                </div>
            )}
        </DialogContent>
      </Dialog>

      {/* Invoice Preview Modal */}
      <Dialog open={isInvoicePreviewOpen} onOpenChange={setIsInvoicePreviewOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-3xl p-6 bg-white dark:bg-slate-900 border-none shadow-2xl">
            <DialogHeader>
                <DialogTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" /> ใบเสนอราคา / แจ้งหนี้
                </DialogTitle>
            </DialogHeader>
            {invoicePreviewData && (
                <div className="mt-4 space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-3">
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">รายการ</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{invoicePreviewData.title || invoicePreviewData.task || 'ค่าบริการทนายความ'}</p>
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-3">
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">ยอดชำระ</p>
                                <p className="text-lg font-black text-blue-600">฿{(invoicePreviewData.amount || invoicePreviewData.price || 0).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">สถานะ</p>
                                <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", invoicePreviewData.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                                    {invoicePreviewData.status === 'paid' ? 'ชำระแล้ว' : 'รอชำระ'}
                                </span>
                            </div>
                        </div>
                    </div>
                    {invoicePreviewData.status !== 'paid' && !isLawyerView && (
                        <Button className="w-full h-11 rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 text-white" asChild>
                            <a href={`/payment?chatId=${chatId}&type=case&amount=${invoicePreviewData.amount || invoicePreviewData.price || 0}`}>💳 ดำเนินการชำระเงิน</a>
                        </Button>
                    )}
                    <Button className="w-full h-11 rounded-2xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" onClick={() => setIsInvoicePreviewOpen(false)}>
                        ปิดหน้าต่าง
                    </Button>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function ChatBox(props: ChatBoxProps) {
  return (
    <ErrorBoundary>
      <ChatBoxContent {...props} />
    </ErrorBoundary>
  );
}

function ImagePreviewContent({ url, name }: { url: string, name: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500 z-10 bg-slate-900/50 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-xs font-black uppercase tracking-widest text-white/80">กำลังโหลดรูปภาพ...</p>
        </div>
      )}
      
      {error ? (
        <div className="flex flex-col items-center gap-5 text-red-400 p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 bg-red-400/10 rounded-[2.5rem] border border-red-400/20 shadow-2xl shadow-red-500/10">
            <AlertTriangle className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <p className="font-black uppercase tracking-widest text-sm text-white">ไม่สามารถโหลดรูปภาพได้</p>
            <p className="text-[10px] opacity-60 font-medium max-w-[240px] break-all text-red-200">{name}</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-[200px]">
            <Button 
                variant="outline" 
                size="sm" 
                className="w-full border-red-400/30 text-white bg-red-400/10 hover:bg-red-400/20 rounded-2xl h-11 font-bold"
                onClick={() => {
                    setError(false);
                    setLoading(true);
                    // Add a tiny cache buster to force a fresh request
                    const buster = url.includes('?') ? `&cb=${Date.now()}` : `?cb=${Date.now()}`;
                    // We can't easily change the prop, but this logic is just a hint
                }}
            >
                <RefreshCcw className="w-4 h-4 mr-2" /> ลองใหม่อีกครั้ง
            </Button>
            <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-red-200 hover:text-white hover:bg-white/5 rounded-2xl h-11"
                onClick={() => window.open(url, '_blank')}
            >
                <ExternalLink className="w-4 h-4 mr-2" /> เปิดในหน้าต่างใหม่
            </Button>
          </div>
        </div>
      ) : (
        <img 
          key={url}
          src={url} 
          alt={name} 
          className={cn(
            "max-w-full max-h-full object-contain rounded-lg transition-all duration-700",
            loading ? "opacity-0 scale-95" : "opacity-100 scale-100"
          )}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      )}
    </div>
  );
}
