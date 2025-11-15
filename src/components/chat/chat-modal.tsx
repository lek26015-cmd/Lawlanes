'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Scale, Send, User, X, Sparkles } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';
import { getAiChatResponse } from '@/app/chat/actions';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  showDisclaimer: boolean;
  onDisclaimerAgree: () => void;
  onDisclaimerCancel: () => void;
}

export default function ChatModal({ 
  isOpen, 
  onClose,
  showDisclaimer,
  onDisclaimerAgree,
  onDisclaimerCancel,
}: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  const suggestedQuestions = [
    'ร่างสัญญา',
    'คดีมรดก',
    'จดทะเบียนบริษัท',
    'คดีที่ดิน',
  ];

  useEffect(() => {
    if (isOpen && messages.length === 0) {
        setMessages([
          {
            id: 'initial',
            role: 'assistant',
            content: 'สวัสดีครับ! ผมคือผู้ช่วย AI ด้านกฎหมายจาก Lawlane มีอะไรให้ผมช่วยวิเคราะห์เบื้องต้นไหมครับ? (นี่คือเวอร์ชั่นสาธิต)'
          }
        ]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    setTimeout(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, 100);
  }, [messages, isLoading]);

  const handleSendMessage = async (e: React.FormEvent, query?: string) => {
    e.preventDefault();
    const messageToSend = query || input;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: messageToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const result = await getAiChatResponse({ query: messageToSend });
    
    if (result.success && result.data) {
       const assistantMessage: ChatMessage = {
         id: (Date.now() + 1).toString(),
         role: 'assistant',
         content: result.data.response,
         needsLawyer: result.data.needsLawyer,
         handoffMessage: result.data.handoffMessage,
       };
       setMessages((prev) => [...prev, assistantMessage]);
    } else {
       const errorMessage: ChatMessage = {
         id: (Date.now() + 1).toString(),
         role: 'assistant',
         content: result.error || 'ขออภัย, เกิดข้อผิดพลาดบางอย่าง',
       };
       setMessages((prev) => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const handleSuggestedQuestionClick = (question: string) => {
    handleSendMessage({ preventDefault: () => {} } as React.FormEvent, question);
  }

  const ChatContent = (
    <>
      <ScrollArea className="flex-1 px-4 sm:px-6" ref={scrollAreaRef}>
        <div className="space-y-6 py-6">
          {messages.map((message) => (
            <div key={message.id} className={cn('flex items-start gap-3 text-sm', message.role === 'user' ? 'justify-end' : 'justify-start')}>
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 border border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary"><Sparkles className="h-4 w-4"/></AvatarFallback>
                </Avatar>
              )}
              <div className={cn("max-w-[80%] rounded-xl p-3", message.role === 'assistant' ? 'bg-muted rounded-bl-none' : 'bg-primary text-primary-foreground rounded-br-none')}>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.needsLawyer && (
                  <div className="mt-3 border-t border-primary/20 pt-3">
                    <p className="font-semibold text-xs mb-2">{message.handoffMessage || 'เคสของคุณอาจต้องการทนายผู้เชี่ยวชาญ'}</p>
                    <Link href="/lawyers" onClick={onClose}>
                      <Button size="sm" variant={message.role === 'assistant' ? 'secondary' : 'default'} className="text-xs h-7">คลิกเพื่อดูรายชื่อทนาย</Button>
                    </Link>
                  </div>
                )}
              </div>
              {message.role === 'user' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback><User className="h-5 w-5"/></AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isLoading && (
             <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 border border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary"><Sparkles className="h-4 w-4"/></AvatarFallback>
                </Avatar>
                <div className="max-w-[80%] rounded-xl p-3 bg-muted rounded-bl-none w-full">
                   <Skeleton className="h-4 w-1/4" />
                   <Skeleton className="h-4 w-full mt-2" />
                   <Skeleton className="h-4 w-3/4 mt-2" />
                </div>
             </div>
          )}
        </div>
      </ScrollArea>
      <div className="px-4 sm:px-6 py-4 border-t bg-background/80 backdrop-blur-sm">
        <div className='mb-3'>
            <p className='text-xs text-muted-foreground mb-2'>คำถามด่วน:</p>
            <div className='flex flex-wrap gap-2'>
                {suggestedQuestions.map((q) => (
                    <Button key={q} size="sm" variant="outline" className='text-xs h-7' onClick={() => handleSuggestedQuestionClick(q)} disabled={isLoading}>
                        {q}
                    </Button>
                ))}
            </div>
        </div>
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำถามของคุณ..."
            autoComplete="off"
            disabled={isLoading}
            className="rounded-full"
          />
          <Button type="submit" size="icon" className="rounded-full flex-shrink-0" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <DrawerContent className="h-[90%] max-h-full flex flex-col outline-none p-0 border-0 bg-background">
            <DrawerHeader className="p-4 pb-2 text-left bg-primary text-primary-foreground">
                <DrawerTitle className="flex items-center gap-2 font-headline">
                 แชทกับ AI
                </DrawerTitle>
            </DrawerHeader>
            {ChatContent}
          </DrawerContent>
        </Drawer>
        <AlertDialog open={showDisclaimer}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ข้อจำกัดความรับผิดชอบ (Disclaimer)</AlertDialogTitle>
              <AlertDialogDescription>
                AI Legal Advisor นี้ให้ข้อมูลเพื่อการประเมินเบื้องต้นเท่านั้น และ "ไม่ใช่คำแนะนำทางกฎหมาย" การตัดสินใจใดๆ ควรทำหลังจากปรึกษาทนายความผู้เชี่ยวชาญแล้ว เราไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดขึ้นจากการใช้ข้อมูลนี้
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={onDisclaimerCancel}>ยกเลิก</Button>
              <AlertDialogAction onClick={onDisclaimerAgree}>ยอมรับและดำเนินการต่อ</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="sm:max-w-sm w-full flex flex-col h-[70vh] max-h-[520px] rounded-2xl overflow-hidden fixed bottom-24 right-6 p-0 border-0 shadow-2xl translate-x-0 translate-y-0"
        >
          <DialogHeader className="p-4 pb-3 border-b bg-primary text-primary-foreground rounded-t-2xl">
            <DialogTitle className="text-base font-headline">
              แชทกับ AI
            </DialogTitle>
          </DialogHeader>
          {ChatContent}
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={showDisclaimer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ข้อจำกัดความรับผิดชอบ (Disclaimer)</AlertDialogTitle>
            <AlertDialogDescription>
              AI Legal Advisor นี้ให้ข้อมูลเพื่อการประเมินเบื้องต้นเท่านั้น และ "ไม่ใช่คำแนะนำทางกฎหมาย" การตัดสินใจใดๆ ควรทำหลังจากปรึกษาทนายความผู้เชี่ยวชาญแล้ว เราไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดขึ้นจากการใช้ข้อมูลนี้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={onDisclaimerCancel}>ยกเลิก</Button>
            <AlertDialogAction onClick={onDisclaimerAgree}>ยอมรับและดำเนินการต่อ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
