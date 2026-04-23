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
import { Send, Loader2, Sparkles, Languages, AlertTriangle, RefreshCcw, Check, CheckCheck, CreditCard } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChat } from '@/context/chat-context';
import { translateToMultipleLanguages } from '@/app/actions/translate';
import { QuickReplies } from './quick-replies';
import { CopyButton } from '@/components/ui/copy-button';
import { useChatSocket } from '@/hooks/use-chat-socket';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/utils';

interface ChatBoxProps {
  firestore: Firestore;
  currentUser: User;
  otherUser: { name: string, userId: string, imageUrl: string };
  chatId: string;
  isDisabled?: boolean;
  isLawyerView?: boolean;
  isUploading?: boolean;
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
}: ChatBoxProps) {
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
    
    // Clear optimistic messages whose text has appeared in the real socket feed
    if (socketMessages.length > 0) {
       const socketTexts = new Set(socketMessages.map(m => m.text));
       setOptimisticMessages(prev => prev.filter(m => !socketTexts.has(m._optimisticText ?? m.text)));
    }
  }, [socketMessages]);

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
    <Card className="flex flex-col h-full w-full shadow-none md:shadow-xl border-none md:rounded-none md:rounded-2xl overflow-hidden bg-transparent md:bg-white">
      <CardHeader className="border-b bg-gray-50/50 py-2.5 md:py-4 px-3 md:px-6">
        <div className="flex flex-row justify-between items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <Avatar className="h-8 w-8 md:h-10 md:w-10 border-2 border-primary/10 flex-shrink-0">
               <AvatarImage src={otherUser.imageUrl} />
               <AvatarFallback className="bg-primary/5 text-primary font-bold">{otherUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 md:gap-2">
                <CardTitle className="text-base md:text-lg font-bold truncate">
                  {chatMetadata?.caseTitle || chatMetadata?.title || 'กำลังโหลด...'}
                </CardTitle>
                <div className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200 font-mono flex-shrink-0">
                  UID: {currentUser?.uid?.substring(0, 8)}...
                </div>
                {isConnected ? (
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" title="Connected" />
                ) : (
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-gray-300 flex-shrink-0" title="Offline" />
                )}
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1 truncate">
                {isLawyerView ? `ลูกความ: ${otherUser.name}` : `ทนายความ: ${otherUser.name}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
             {isLawyerView && <QuickReplies onSelect={(text) => { setInput(text); localStorage.setItem(`chat_draft_${chatId}`, text); }} />}
             <CopyButton value={chatId} className="h-7 w-7 md:h-8 md:w-8 rounded-lg md:rounded-xl" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-grow p-0 flex flex-col min-h-0 bg-slate-50/30">
        <ScrollArea className="flex-grow" ref={scrollAreaRef}>
          <div className="space-y-6 px-4 py-4 md:px-6 md:py-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 text-amber-900 text-xs md:text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
              <p>คำเตือน: ห้ามโอนเงินนอกระบบ Lawlanes เพื่อความปลอดภัยของข้อมูลและเงินของคุณ</p>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 max-w-[85%]">
                <div className="p-4 rounded-lg bg-white border border-gray-100 shadow-sm">
                  <p className="font-bold text-xs text-primary uppercase tracking-wider mb-1">
                    {isLawyerView ? "AI: สรุปข้อความเบื้องต้น" : "ข้อมูลที่คุณส่งให้ทนาย"}
                  </p>
                  <p className="text-sm text-gray-700 italic">
                    {firstUserMessage ? `"${firstUserMessage.text}"` : "กำลังรอข้อมูล..."}
                  </p>
                </div>
              </div>
            </div>

            {allMessages.map((msg, idx) => {
              const isOwn = msg.senderId === currentUser.uid;
              const showAvatar = !isOwn && (idx === 0 || allMessages[idx-1].senderId !== msg.senderId);
              const isLastMsg = idx === allMessages.length - 1;

              return (
                <div key={msg.id} className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                  <div className={cn("flex items-end gap-2 max-w-[85%] md:max-w-[70%]", isOwn && "flex-row-reverse")}>
                    {!isOwn && (
                      <div className="w-8 flex-shrink-0">
                        {showAvatar && (
                          <Avatar className="h-8 w-8 shadow-sm">
                            <AvatarImage src={otherUser.imageUrl} />
                            <AvatarFallback>{otherUser.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      {(() => {
                        const isPaymentProposal = msg.text.includes('ใบเสนอราคาใหม่:') || msg.text.includes('แจ้งชำระค่าบริการ:');
                        let paymentAmount = '0';
                        if (isPaymentProposal) {
                            const match = msg.text.match(/฿([\d,]+\.?\d*)/);
                            if (match) paymentAmount = match[1];
                        }

                        return (
                          <div className={cn(
                            "rounded-2xl text-sm shadow-sm overflow-hidden",
                            isPaymentProposal 
                                ? "w-[260px] md:w-[300px] bg-white border border-blue-100 dark:bg-slate-800 dark:border-slate-700" 
                                : (isOwn ? "px-4 py-2.5 bg-primary text-white rounded-tr-md" : "px-4 py-2.5 bg-white border border-gray-100 text-gray-800 rounded-tl-md"),
                            !isPaymentProposal && msg.status === 'sending' && "opacity-70 animate-pulse",
                            msg.status === 'error' && "border-red-500 bg-red-50 text-red-800"
                          )}>
                            {isPaymentProposal ? (
                               <div className="flex flex-col">
                                   <div className="bg-blue-600 p-3 text-white">
                                       <div className="flex justify-between items-center">
                                          <p className="font-bold text-sm flex items-center gap-1"><CreditCard className="w-4 h-4"/> แจ้งชำระเงิน</p>
                                          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-2xl font-mono">{paymentAmount} ฿</span>
                                       </div>
                                   </div>
                                   <div className="p-4 bg-white space-y-3">
                                       <p className="text-xs text-slate-600 whitespace-pre-wrap break-words line-clamp-4">{msg.text}</p>
                                       <Button 
                                          className="w-full h-9 bg-blue-600 hover:bg-blue-700 font-bold rounded-2xl shadow-md text-xs" 
                                          asChild
                                       >
                                          <a href={`/payment?chatId=${chatId}&type=${msg.text.includes('ค่าบริการ') ? 'consultation' : 'case'}`} target="_blank" rel="noopener noreferrer">
                                            💳 ดำเนินการชำระเงิน
                                          </a>
                                       </Button>
                                   </div>
                               </div>
                            ) : (
                               <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            )}
                          </div>
                        );
                      })()}
                      
                      {msg.status === 'error' && (
                        <button onClick={() => retryMessage(msg)} className="text-[10px] text-red-500 flex items-center gap-1 mt-1 hover:underline">
                          <RefreshCcw className="w-3 h-3" /> ส่งไม่สำเร็จ คลิกเพื่อลองใหม่
                        </button>
                      )}

                      {!isOwn && (
                        <button 
                          onClick={() => handleTranslateMessage(msg.id, msg.text)}
                          className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-0.5"
                        >
                          {msg.isTranslating ? <Loader2 className="w-3 h-3 animate-spin"/> : <Languages className="w-3 h-3"/>}
                          {msg.translation ? 'แปลซ้ำ' : 'แปลภาษา'}
                        </button>
                      )}
                      
                      {msg.translation && !isOwn && (
                        <div className="mt-1 p-2 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-primary/80 italic">
                           {msg.translation}
                        </div>
                      )}
                    </div>
                  </div>
                  {isOwn && isLastMsg && (
                    <div className="mt-1 mr-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                       {isLawyerView ? (
                         chatMetadata?.clientReadAt ? (
                           <span className="text-green-600 flex items-center gap-0.5"><CheckCheck className="w-3 h-3"/> อ่านแล้ว</span>
                         ) : <Check className="w-3 h-3"/>
                       ) : (
                         chatMetadata?.lawyerReadAt ? (
                           <span className="text-green-600 flex items-center gap-0.5"><CheckCheck className="w-3 h-3"/> ทนายอ่านแล้ว</span>
                         ) : <Check className="w-3 h-3"/>
                       )}
                    </div>
                  )}
                </div>
              );
            })}

            {isPartnerTyping && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse ml-10">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
                </div>
                <span>{otherUser.name} กำลังพิมพ์...</span>
              </div>
            )}

            {isUploading && (
              <div className="flex items-center gap-2 text-xs text-blue-600 animate-pulse ml-10">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="font-medium">กำลังส่งไฟล์...</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="px-4 py-3 md:px-6 md:py-4 border-t bg-white">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
          className="flex items-center w-full gap-2"
        >
          <div className="relative flex-grow">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder={isDisabled ? "การสนทนานี้สิ้นสุดแล้ว" : "พิมพ์ข้อความที่นี่..."}
              disabled={isSocketLoading || isDisabled}
              className="pr-12 rounded-xl bg-gray-50 border-none h-11 focus-visible:ring-primary shadow-inner"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={isSocketLoading || !input.trim() || isDisabled}
            className="rounded-lg w-11 h-11 bg-primary hover:bg-primary/90 shadow-md transition-all active:scale-95"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </CardFooter>
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
