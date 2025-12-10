
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
  updateDoc,
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
  otherUser: { name: string, userId: string, imageUrl: string };
  chatId: string;
  isDisabled?: boolean;
  isLawyerView?: boolean;
}

export function ChatBox({
  firestore,
  currentUser,
  otherUser,
  chatId,
  isDisabled = false,
  isLawyerView = false,
}: ChatBoxProps) {
  const [messages, setMessages] = useState<HumanChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isChatReady, setIsChatReady] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { initialChatMessage, setInitialChatMessage } = useChat();

  useEffect(() => {
    if (!chatId || !currentUser.uid || !otherUser.userId) {
      console.warn("ChatBox missing required props:", { chatId, currentUser: currentUser?.uid, otherUser: otherUser?.userId });
      setIsLoading(false); // Stop loading if props are missing
      return;
    }

    const chatRef = doc(firestore, 'chats', chatId);

    const ensureChatExists = async () => {
      const chatDocQuery = query(collection(firestore, 'chats'), where('__name__', '==', chatId));

      try {
        const chatDoc = await getDocs(chatDocQuery);
        if (chatDoc.empty) {
          const newChatData = {
            participants: [currentUser.uid, otherUser.userId],
            createdAt: serverTimestamp(),
            caseTitle: 'คดี: มรดก', // Mock data
          };
          setDoc(chatRef, newChatData)
            .then(() => {
              setIsChatReady(true);
            })
            .catch(serverError => {
              const permissionError = new FirestorePermissionError({
                path: chatRef.path,
                operation: 'create',
                requestResourceData: newChatData,
              });
              errorEmitter.emit('permission-error', permissionError);
            });
        } else {
          setIsChatReady(true);
        }
      } catch (error) {
        console.error("Error ensuring chat exists:", error);
        const permissionError = new FirestorePermissionError({
          path: 'chats',
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setIsLoading(false); // Stop loading on error
      }
    };

    ensureChatExists();

  }, [chatId, currentUser.uid, otherUser.userId, firestore]);

  useEffect(() => {
    if (initialChatMessage && isChatReady) {
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

      setInitialChatMessage('');
    }
  }, [chatId, initialChatMessage, currentUser.uid, firestore, setInitialChatMessage, isChatReady]);


  useEffect(() => {
    if (!isChatReady) return;

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
  }, [chatId, firestore, isChatReady]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollableNode = scrollAreaRef.current.querySelector('div[style*="overflow: scroll"]');
      if (scrollableNode) {
        scrollableNode.scrollTop = scrollableNode.scrollHeight;
      }
    }
  }, [messages]);


  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isDisabled || !isChatReady) return;

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

  // Mark as read by lawyer
  useEffect(() => {
    if (isLawyerView && isChatReady && chatId) {
      const chatRef = doc(firestore, 'chats', chatId);
      updateDoc(chatRef, {
        lawyerReadAt: serverTimestamp()
      }).catch(err => console.warn("Failed to mark chat as read:", err));
    }
  }, [isLawyerView, isChatReady, chatId, firestore]);

  const [lawyerReadAt, setLawyerReadAt] = useState<any>(null);

  // Listen for chat metadata (read status)
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(firestore, 'chats', chatId);
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        setLawyerReadAt(doc.data().lawyerReadAt);
      }
    });
    return () => unsubscribe();
  }, [chatId, firestore]);

  const firstUserMessage = messages.find(m => m.senderId !== (isLawyerView ? currentUser.uid : otherUser.userId));

  return (
    <Card className="flex flex-col h-[80vh] shadow-lg">
      <CardHeader className="border-b">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl">คดี: มรดก</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isLawyerView ? `เคสของ ${otherUser.name}` : `สนทนากับ ${otherUser.name}`}
            </p>
          </div>
          {!isLawyerView && lawyerReadAt && (
            <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
              <Sparkles className="w-3 h-3" />
              <span>ทนายอ่านแล้ว</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-grow p-0 flex flex-col min-h-0">
        <ScrollArea className="flex-grow p-6" ref={scrollAreaRef}>
          <div className="space-y-6">
            {/* Show Summary to BOTH Lawyer and Client */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                  <p className="font-semibold text-sm text-yellow-800">
                    {isLawyerView ? "AI: สรุปข้อเท็จจริงเบื้องต้นจากลูกความ" : "ข้อมูลที่คุณส่งให้ทนายความ"}
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {firstUserMessage ? `"${firstUserMessage.text}"` : "กำลังรอข้อความแรก..."}
                  </p>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : !isChatReady ? (
              <div className="text-center text-destructive text-sm py-8">
                ไม่สามารถโหลดข้อมูลแชทได้ กรุณาลองใหม่อีกครั้ง
              </div>
            ) : messages.length === 0 && !initialChatMessage ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                เริ่มต้นการสนทนา...
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${msg.senderId === currentUser.uid
                    ? 'justify-end'
                    : 'justify-start'
                    }`}
                >
                  {msg.senderId !== currentUser.uid && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={otherUser.imageUrl} />
                      <AvatarFallback>
                        {otherUser.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-md rounded-lg px-4 py-2 shadow-sm text-sm ${msg.senderId === currentUser.uid
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
            placeholder={isDisabled ? "การสนทนานี้สิ้นสุดแล้ว" : "พิมพ์ข้อความ..."}
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
