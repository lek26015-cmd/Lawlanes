
'use client';
import { useState, useEffect, useRef } from 'react';
import type { ReportedTicket } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, UserCog } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/firebase/auth/use-user';
import { useFirebase } from '@/firebase';

interface SupportChatBoxProps {
  ticket: ReportedTicket;
  isDisabled?: boolean;
}

interface SupportMessage {
    id: string;
    role: 'user' | 'admin';
    text: string;
    senderName: string;
    avatarUrl?: string;
}

export function SupportChatBox({ ticket, isDisabled = false }: SupportChatBoxProps) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { auth } = useFirebase();
  const { data: user } = useUser(auth);

  const adminProfile = {
      name: 'ฝ่ายสนับสนุน',
      avatar: "https://picsum.photos/seed/admin-avatar/100/100"
  };

  useEffect(() => {
    // Simulate fetching initial messages for the ticket
    setIsLoading(true);
    setTimeout(() => {
        setMessages([
            {
                id: '1',
                role: 'admin',
                text: `สวัสดีครับคุณสมหญิง ผม 'แอดมินพัฒน์' จากฝ่ายสนับสนุนลูกค้า Lawlane ครับ ขอทราบรายละเอียดของปัญหาเกี่ยวกับเคส "${ticket.caseTitle}" เพิ่มเติมได้ไหมครับ`,
                senderName: adminProfile.name,
                avatarUrl: adminProfile.avatar
            }
        ]);
        setIsLoading(false);
    }, 1000);
  }, [ticket.id, ticket.caseTitle]);
  
   useEffect(() => {
    // Auto-scroll to bottom
    if (scrollAreaRef.current) {
        const scrollableNode = scrollAreaRef.current.querySelector('div[style*="overflow: scroll"]');
        if(scrollableNode) {
            scrollableNode.scrollTop = scrollableNode.scrollHeight;
        }
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || !user || isDisabled) return;

    const userMessage: SupportMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      senderName: user.displayName || 'ลูกค้า',
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate admin response
    setTimeout(() => {
        const adminResponse: SupportMessage = {
            id: (Date.now() + 1).toString(),
            role: 'admin',
            text: 'ขอบคุณสำหรับข้อมูลครับ ทางเราได้รับเรื่องแล้วและกำลังดำเนินการตรวจสอบให้อย่างเร่งด่วนครับ จะแจ้งความคืบหน้าให้ทราบอีกครั้งภายใน 24 ชั่วโมงครับ',
            senderName: adminProfile.name,
            avatarUrl: adminProfile.avatar,
        };
        setMessages(prev => [...prev, adminResponse]);
        setIsLoading(false);
    }, 1500);
  };

  return (
    <Card className="flex flex-col h-[80vh] shadow-lg">
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Ticket: {ticket.id}</CardTitle>
        <p className="text-sm text-muted-foreground">พูดคุยกับฝ่ายสนับสนุนเกี่ยวกับเคส "{ticket.caseTitle}"</p>
      </CardHeader>
      
      <CardContent className="flex-grow p-0 flex flex-col min-h-0">
          <ScrollArea className="flex-grow p-6" ref={scrollAreaRef}>
            <div className="space-y-6">
                 {isLoading && messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                 ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-3 ${
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.role === 'admin' && (
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={msg.avatarUrl} />
                            <AvatarFallback><UserCog className="w-5 h-5"/></AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex flex-col gap-1 items-end">
                            <div
                            className={`max-w-md rounded-lg px-4 py-2 shadow-sm text-sm ${
                                msg.role === 'user'
                                ? 'bg-foreground text-background self-end'
                                : 'bg-gray-200'
                            }`}
                            >
                            <p>{msg.text}</p>
                            </div>
                             <span className="text-xs text-muted-foreground">
                                {msg.senderName}
                            </span>
                        </div>
                        {msg.role === 'user' && (
                             <Avatar className="h-10 w-10">
                                <AvatarImage src="https://picsum.photos/seed/user-avatar/100/100" />
                                <AvatarFallback>สใ</AvatarFallback>
                            </Avatar>
                        )}
                      </div>
                    ))
                 )}
                  {isLoading && messages.length > 0 && (
                    <div className="flex items-center gap-3 justify-start">
                         <Avatar className="h-10 w-10">
                             <AvatarImage src={adminProfile.avatar} />
                            <AvatarFallback><UserCog className="w-5 h-5"/></AvatarFallback>
                        </Avatar>
                        <div className="p-3 bg-gray-200 rounded-lg">
                           <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    </div>
                 )}
            </div>
          </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t bg-white">
        <form onSubmit={handleSendMessage} className="flex items-center w-full space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isDisabled ? "Ticket นี้ได้รับการแก้ไขแล้ว" : "พิมพ์ข้อความถึงฝ่ายสนับสนุน..."}
            disabled={isLoading || isDisabled}
            className="flex-grow rounded-full"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim() || isDisabled}
            className="rounded-full w-10 h-10 bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
