
'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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
  getDoc,
  setDoc,
  updateDoc,
  Firestore,
  Query,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { 
  ensureChatExistsAction, 
  sendChatMessageAction, 
  markChatAsReadAction 
} from '@/app/actions/chat-actions';
import type { LawyerProfile, HumanChatMessage } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Sparkles, Languages, AlertTriangle, FolderPlus, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChat } from '@/context/chat-context';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { translateToMultipleLanguages } from '@/app/actions/translate';
import { QuickReplies } from './quick-replies';
import { CopyButton } from '@/components/ui/copy-button';

interface ChatBoxProps {
  firestore: Firestore;
  currentUser: User;
  otherUser: { name: string, userId: string, imageUrl: string };
  chatId: string;
  isDisabled?: boolean;
  isLawyerView?: boolean;
}

// Extend message type with translation
interface MessageWithTranslation extends HumanChatMessage {
  translation?: string;
  isTranslating?: boolean;
}

import { useChatSocket } from '@/hooks/use-chat-socket';

export function ChatBox({
  firestore,
  currentUser,
  otherUser,
  chatId,
  isDisabled = false,
  isLawyerView = false,
}: ChatBoxProps) {
  const { 
    messages: socketMessages, 
    isConnected, 
    isLoading: isSocketLoading, 
    sendMessage 
  } = useChatSocket(chatId, currentUser.uid, currentUser.displayName || 'คู่สนทนา');

  const [messages, setMessages] = useState<MessageWithTranslation[]>([]);
  const [input, setInput] = useState('');
  const [isChatReady, setIsChatReady] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { initialChatMessage, setInitialChatMessage } = useChat();

  // Sync socket messages with local state (for translations)
  useEffect(() => {
    setMessages(socketMessages.map(msg => ({
      ...msg,
      translation: (messages.find(m => m.id === msg.id) as any)?.translation,
      isTranslating: (messages.find(m => m.id === msg.id) as any)?.isTranslating,
    })));
  }, [socketMessages]);

  const [chatMetadata, setChatMetadata] = useState<any>(null);

  // Fetch chat metadata
  useEffect(() => {
    if (!chatId || !firestore) return;
    const chatRef = doc(firestore, 'chats', chatId);
    getDoc(chatRef).then(docSnap => {
      if (docSnap.exists()) {
        setChatMetadata(docSnap.data());
      }
    });
  }, [chatId, firestore]);

  useEffect(() => {
    if (chatId && currentUser.uid && otherUser.userId && chatMetadata) {
      // Ensure chat exists in D1
      const ensureChat = async () => {
        try {
          const caseTitle = chatMetadata.caseTitle || chatMetadata.title || 'คดีใหม่';
          
          // Fallback to server action first for reliability
          await ensureChatExistsAction(chatId, [currentUser.uid, otherUser.userId], caseTitle).catch(e => console.warn("D1 Sync via Server Action failed:", e));

          // Then attempt worker sync if available
          const workerUrl = process.env.NEXT_PUBLIC_CHAT_WORKER_URL;
          if (workerUrl && workerUrl !== 'undefined') {
            await fetch(`${workerUrl}/ensure-chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chatId,
                participants: [currentUser.uid, otherUser.userId],
                caseTitle: caseTitle
              })
            }).catch(e => {
               // Silently fail worker sync as we have D1/Firebase backup
               console.warn("Worker sync skipped (unreachable)");
            });
          }
          
          setIsChatReady(true);
        } catch (err) {
          console.error("Chat initialization failed:", err);
          setIsChatReady(true); // Always allow chat to proceed with Firebase fallback
        }
      };
      ensureChat();
    } else if (chatId && currentUser.uid && otherUser.userId && !chatMetadata) {
       // Still proceed if metadata fetch is slow
       setIsChatReady(true);
    }
  }, [chatId, currentUser.uid, otherUser.userId, chatMetadata]);

  const handleTranslateMessage = async (messageId: string, text: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, isTranslating: true } : msg
    ));

    try {
      const result = await translateToMultipleLanguages(text);
      const translatedText = result.english;

      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, translation: translatedText, isTranslating: false }
          : msg
      ));
    } catch (error) {
      console.error('Translation failed:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, isTranslating: false } : msg
      ));
    }
  };

  useEffect(() => {
    if (initialChatMessage && isChatReady && isConnected) {
      const message = initialChatMessage;
      setInitialChatMessage('');
      sendMessage(message, otherUser.userId);
    }
  }, [chatId, initialChatMessage, isChatReady, isConnected, sendMessage, otherUser.userId, setInitialChatMessage]);

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
    if (!input.trim() || isDisabled || !isConnected) return;

    const messageText = input;
    setInput('');
    sendMessage(messageText, otherUser.userId);
  };

  // Mark as read (We can still use the Firebase action for now if needed, 
  // or migrate to worker later. Keeping it for compatibility with old dashboard if any)
  useEffect(() => {
    if (isLawyerView && isChatReady && chatId) {
      markChatAsReadAction(chatId).catch(err => console.warn("Failed to mark chat as read:", err));
    }
  }, [isLawyerView, isChatReady, chatId]);

  const [lawyerReadAt, setLawyerReadAt] = useState<any>(null);

  // Still listening to Firebase for "read" status for now as it's a separate metadata 
  // that might be used elsewhere.
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(firestore, 'chats', chatId);
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        setLawyerReadAt(doc.data().lawyerReadAt);
        // Also update local metadata if it changed (e.g. title)
        setChatMetadata(doc.data());
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
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">
                {chatMetadata?.caseTitle || chatMetadata?.title || 'กำลังโหลด...'}
              </CardTitle>
              <span className="text-xs font-mono text-muted-foreground">({chatId})</span>
              <CopyButton value={chatId} className="h-4 w-4" />
            </div>
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
          {isLawyerView && (
            <div className="flex items-center gap-2">
              <QuickReplies onSelect={(text) => setInput(text)} />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-grow p-0 flex flex-col min-h-0">
        <ScrollArea className="flex-grow p-6" ref={scrollAreaRef}>
          <div className="space-y-6">
            {/* Payment Warning Warning Banner */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800 shadow-sm animate-pulse-slow">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
              <div className="text-sm">
                <p className="font-bold">คำเตือนเพื่อความปลอดภัย</p>
                <p>ห้ามโอนเงินหรือตกลงค่าใช้จ่ายนอกระบบ Lawlanes โดยเด็ดขาด เพื่อป้องกันการถูกหลอกลวงและความคุ้มครองจากแพลตฟอร์ม</p>
              </div>
            </div>

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

            {isSocketLoading ? (
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
              messages.map((msg) => {
                const isOwnMessage = msg.senderId === currentUser.uid;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isOwnMessage && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={otherUser.imageUrl} />
                        <AvatarFallback>
                          {otherUser.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex flex-col gap-1">
                      <div
                        className={`max-w-md rounded-lg px-4 py-2 shadow-sm text-sm ${isOwnMessage
                          ? 'bg-foreground text-background'
                          : 'bg-gray-200'
                          }`}
                      >
                        <p>{msg.text}</p>
                      </div>

                      {/* Translate button - show for messages from other user */}
                      {!isOwnMessage && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTranslateMessage(msg.id, msg.text)}
                            disabled={msg.isTranslating}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          >
                            {msg.isTranslating ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Languages className="w-3 h-3" />
                            )}
                            <span>{msg.translation ? 'แปลใหม่' : 'แปลภาษา'}</span>
                          </button>
                        </div>
                      )}

                      {/* Translation display */}
                      {msg.translation && !isOwnMessage && (
                        <div className="max-w-md px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs">
                          <p className="text-blue-700 font-medium mb-1">คำแปล:</p>
                          <p className="text-blue-800">{msg.translation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
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
            disabled={isSocketLoading || isDisabled}
            className="flex-grow rounded-full"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isSocketLoading || !input.trim() || isDisabled}
            className="rounded-full w-10 h-10 bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
