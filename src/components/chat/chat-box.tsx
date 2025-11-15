
'use client';
import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  doc,
  setDoc,
  Firestore,
  Query,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { LawyerProfile, HumanChatMessage } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChat } from '@/context/chat-context';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

interface ChatBoxProps {
  firestore: Firestore;
  currentUser: User;
  lawyer: LawyerProfile;
  chatId: string;
}

export function ChatBox({
  firestore,
  currentUser,
  lawyer,
  chatId,
}: ChatBoxProps) {
  const [messages, setMessages] = useState<HumanChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { initialChatMessage, setInitialChatMessage } = useChat();

  useEffect(() => {
    // This effect ensures the chat document exists in Firestore.
    // In a real app, this would be created upon successful payment.
    const chatRef = doc(firestore, 'chats', chatId);
    getDocs(query(collection(firestore, 'chats'), where('__name__', '==', chatId)))
        .then(snapshot => {
            if (snapshot.empty) {
                const newChatData = {
                    participants: [currentUser.uid, lawyer.userId],
                    createdAt: serverTimestamp(),
                    caseTitle: 'คดี: มรดก', // Mock data
                };
                setDoc(chatRef, newChatData)
                    .catch(serverError => {
                        const permissionError = new FirestorePermissionError({
                            path: chatRef.path,
                            operation: 'create',
                            requestResourceData: newChatData,
                        });
                        errorEmitter.emit('permission-error', permissionError);
                    });
            }
        })
        .catch(error => {
            const permissionError = new FirestorePermissionError({
                path: 'chats',
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  }, [chatId, currentUser.uid, lawyer.userId, firestore]);

  useEffect(() => {
    // This effect sends the very first message if it exists from the payment flow.
    if (initialChatMessage && chatId) {
      const messagesColRef = collection(firestore, 'chats', chatId, 'messages');
      
      const messageData = {
        text: initialChatMessage,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
      };
      
      addDoc(messagesColRef, messageData)
        .catch(serverError => {
          const permissionError = new FirestorePermissionError({
            path: messagesColRef.path,
            operation: 'create',
            requestResourceData: messageData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });

      // Clear the initial message from context so it's not sent again
      setInitialChatMessage('');
    }
  }, [chatId, initialChatMessage, currentUser.uid, firestore, setInitialChatMessage]);


  useEffect(() => {
    // This effect listens for new messages in the chat.
    const messagesQuery = query(
      collection(firestore, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    
    setIsLoading(true);
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as HumanChatMessage));
      setMessages(msgs);
      setIsLoading(false);
    }, (error) => {
        const permissionError = new FirestorePermissionError({
          path: `chats/${chatId}/messages`,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [chatId, firestore]);
  
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
    if (!input.trim()) return;

    const messageData = {
      text: input,
      senderId: currentUser.uid,
      timestamp: serverTimestamp(),
    };
    
    setInput('');

    const messagesColRef = collection(firestore, 'chats', chatId, 'messages');

    addDoc(messagesColRef, messageData)
      .catch(serverError => {
        const permissionError = new FirestorePermissionError({
          path: messagesColRef.path,
          operation: 'create',
          requestResourceData: messageData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  return (
    <Card className="flex flex-col h-[80vh] shadow-lg">
      <CardHeader className="border-b">
        <CardTitle className="text-xl">คดี: มรดก</CardTitle>
        <p className="text-sm text-muted-foreground">สนทนากับ {lawyer.name}</p>
      </CardHeader>
      
      <CardContent className="flex-grow p-0 flex flex-col min-h-0">
          <ScrollArea className="flex-grow p-6" ref={scrollAreaRef}>
            <div className="space-y-6">
                {/* AI Summary Message */}
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                             <p className="font-semibold text-sm text-yellow-800">AI: สรุปข้อเท็จจริงเบื้องต้นจากลูกความ</p>
                             <p className="text-sm text-yellow-700 mt-1">
                               (AI สรุปข้อเท็จจริง) ลูกค้าแจ้งว่า: "ฉันต้องการหย่ากับผัวเพราะมันไปมีเมียน้อย ทำให้ลูกต้องกำพร้า แบบนี้ต้องฟ้องเอาค่าเสียหายให้เข็ด" (นี่คือข้อมูลจำลองที่ AI ช่วยสรุปให้ทนายครับ)
                             </p>
                        </div>
                    </div>
                </div>

                 {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                 ) : messages.length === 0 && !initialChatMessage ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                        เริ่มต้นการสนทนา...
                    </div>
                 ): (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${
                          msg.senderId === currentUser.uid
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        {msg.senderId !== currentUser.uid && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={lawyer.imageUrl} />
                            <AvatarFallback>
                              {lawyer.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`max-w-md rounded-lg px-4 py-2 shadow-sm text-sm ${
                            msg.senderId === currentUser.uid
                              ? 'bg-foreground text-background'
                              : 'bg-gray-200'
                          }`}
                        >
                          <p>{msg.text}</p>
                        </div>
                      </div>
                    ))
                 )}
            </div>
          </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t bg-white">
        <form onSubmit={handleSendMessage} className="flex items-center w-full space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์ข้อความ..."
            disabled={isLoading}
            className="flex-grow rounded-full"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="rounded-full w-10 h-10 bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
