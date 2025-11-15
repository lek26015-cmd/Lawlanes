'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Scale, Send, User } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';
import { getAiChatResponse } from '@/app/chat/actions';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAgreed, setDisclaimerAgreed] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !disclaimerAgreed) {
      setShowDisclaimer(true);
    }
  }, [isOpen, disclaimerAgreed]);
  
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);
  
  const handleDisclaimerAgree = () => {
    setDisclaimerAgreed(true);
    setShowDisclaimer(false);
    setMessages([
      {
        id: 'initial',
        role: 'assistant',
        content: 'สวัสดีครับ ผมคือ AI Legal Advisor ยินดีให้คำปรึกษาเบื้องต้นด้านกฎหมายแพ่งและพาณิชย์สำหรับ SMEs ครับ'
      }
    ]);
  };

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
  
  const handleClose = () => {
    onClose();
    // Reset for next time
    setTimeout(() => {
      if (!disclaimerAgreed) {
        setMessages([]);
      }
    }, 300);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[425px] md:max-w-[600px] lg:max-w-[800px] flex flex-col h-[80vh] max-h-[800px] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 font-headline">
              <Scale /> AI Legal Advisor
            </DialogTitle>
            <DialogDescription>
              นี่ไม่ใช่คำแนะนำทางกฎหมาย เป็นเพียงการประเมินเบื้องต้น
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6" ref={scrollAreaRef}>
            <div className="space-y-4">
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
            <Button variant="outline" onClick={handleClose}>ยกเลิก</Button>
            <AlertDialogAction onClick={handleDisclaimerAgree}>ยอมรับและดำเนินการต่อ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
