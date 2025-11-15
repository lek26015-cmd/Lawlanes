'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Scale, Send, User, X } from 'lucide-react';
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
  
  useEffect(() => {
    if (isOpen && messages.length === 0) {
        setMessages([
          {
            id: 'initial',
            role: 'assistant',
            content: 'สวัสดีครับ ผมคือ AI Legal Advisor ยินดีให้คำปรึกษาเบื้องต้นด้านกฎหมายแพ่งและพาณิชย์สำหรับ SMEs ครับ'
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const result = await getAiChatResponse({ query: input });
    
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

  const ChatContent = (
    <>
      <ScrollArea className="flex-1 px-6" ref={scrollAreaRef}>
        <div className="space-y-4 py-4">
          {messages.map((message) => (
            <div key={message.id} className={cn('flex items-start gap-3', message.role === 'user' ? 'justify-end' : '')}>
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground"><Scale className="h-5 w-5"/></AvatarFallback>
                </Avatar>
              )}
              <div className={cn("max-w-[75%] rounded-lg p-3 text-sm", message.role === 'assistant' ? 'bg-muted' : 'bg-primary text-primary-foreground')}>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.needsLawyer && (
                  <div className="mt-4 border-t border-primary/20 pt-3">
                    <p className="font-semibold text-sm mb-2">{message.handoffMessage || 'เคสของคุณอาจต้องการทนายผู้เชี่ยวชาญ'}</p>
                    <Link href="/lawyers" onClick={onClose}>
                      <Button size="sm" variant={message.role === 'assistant' ? 'secondary' : 'default'}>คลิกเพื่อดูรายชื่อทนาย</Button>
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
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground"><Scale className="h-5 w-5"/></AvatarFallback>
                </Avatar>
                <div className="max-w-[75%] rounded-lg p-3 bg-muted w-full">
                   <Skeleton className="h-4 w-1/4" />
                   <Skeleton className="h-4 w-full mt-2" />
                   <Skeleton className="h-4 w-3/4 mt-2" />
                </div>
             </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-6 pt-4 border-t">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำถามของคุณที่นี่..."
            autoComplete="off"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={isOpen} onOpenChange={onClose}>
          <DrawerContent className="h-full max-h-full flex flex-col outline-none p-0 border-0">
             <div className="relative h-full flex flex-col bg-background">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600" />
                <div className="relative bg-background h-full flex flex-col">
                    <DrawerHeader className="p-4 pb-2 text-left">
                        <DrawerTitle className="flex items-center gap-2 font-headline">
                        <Scale /> AI Legal Advisor
                        </DrawerTitle>
                        <DrawerDescription>
                        นี่ไม่ใช่คำแนะนำทางกฎหมาย เป็นเพียงการประเมินเบื้องต้น
                        </DrawerDescription>
                    </DrawerHeader>
                    {ChatContent}
                </div>
            </div>
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
          className="p-0 border-0 shadow-2xl fixed bottom-[88px] right-6 sm:max-w-md md:max-w-lg w-full flex flex-col h-[70vh] max-h-[600px] rounded-2xl overflow-hidden bg-transparent"
          hideCloseButton
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 rounded-2xl animate-rainbow-border-spin" />
           <div className="relative bg-background w-full h-full flex flex-col rounded-xl overflow-hidden">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="flex items-center gap-2 font-headline">
                <Scale /> AI Legal Advisor
              </DialogTitle>
              <DialogDescription>
                นี่ไม่ใช่คำแนะนำทางกฎหมาย เป็นเพียงการประเมินเบื้องต้น
              </DialogDescription>
               <button onClick={onClose} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
              </button>
            </DialogHeader>
            {ChatContent}
          </div>
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
