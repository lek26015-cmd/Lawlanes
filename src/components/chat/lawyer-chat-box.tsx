
'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
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
import { Send, Loader2, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFirebase } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useChat } from '@/context/chat-context';

interface LawyerChatBoxProps {
  firestore: Firestore;
  currentUser: User;
  lawyer: LawyerProfile;
  onClose?: () => void;
}

export function LawyerChatBox({
  firestore,
  currentUser,
  lawyer,
  onClose
}: LawyerChatBoxProps) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<HumanChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { initialChatMessage, setInitialChatMessage } = useChat();

  const chatQuery = useMemo(() => {
    if (!firestore || !currentUser || !lawyer) return null;
    return query(
        collection(firestore, 'chats'),
        where('participants', 'array-contains', currentUser.uid),
    );
  }, [firestore, currentUser, lawyer]);


  useEffect(() => {
    if (!chatQuery || !lawyer) return;
    
    let isMounted = true;
    setIsLoading(true);
    
    const findOrCreateChat = () => {
        getDocs(chatQuery)
            .then(querySnapshot => {
                if(!isMounted) return;

                const existingChat = querySnapshot.docs.find(doc =>
                    doc.data().participants.includes(lawyer.userId)
                );

                if (existingChat) {
                    setChatId(existingChat.id);
                } else {
                    const newChatId = uuidv4();
                    const chatRef = doc(firestore, 'chats', newChatId);
                    const newChatData = {
                        participants: [currentUser.uid, lawyer.userId],
                        createdAt: serverTimestamp(),
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

                    setChatId(newChatId);
                }
            })
            .catch(error => {
                // This might be a permission error on the 'list' operation itself.
                const permissionError = new FirestorePermissionError({
                    path: (chatQuery as Query)._query?.path?.canonicalString() || 'chats',
                    operation: 'list',
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoading(false);
                }
            });
    };

    findOrCreateChat();
    
    return () => { 
        isMounted = false;
        setMessages([]);
        setChatId(null);
    };

  }, [chatQuery, currentUser.uid, lawyer.userId, firestore]);
  
  // Effect to handle sending the initial message
  useEffect(() => {
    if (initialChatMessage && chatId && !isLoading) {
      const messageData = {
        text: initialChatMessage,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        id: uuidv4(),
      };
      
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

      // Clear the initial message from context so it's not sent again
      setInitialChatMessage('');
    }
  }, [chatId, isLoading, initialChatMessage, currentUser.uid, firestore, setInitialChatMessage]);

  useEffect(() => {
    if (!chatId) {
        setMessages([]);
        return;
    };

    const messagesQuery = query(
      collection(firestore, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as HumanChatMessage));
      setMessages(msgs);
    }, (error) => {
        const permissionError = new FirestorePermissionError({
          path: `chats/${chatId}/messages`,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [chatId, firestore]);
  
   useEffect(() => {
    if (scrollAreaRef.current) {
        const scrollableNode = scrollAreaRef.current.querySelector('div[style*="overflow: scroll"]');
        if(scrollableNode) {
            scrollableNode.scrollTop = scrollableNode.scrollHeight;
        }
    }
  }, [messages]);


  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || !chatId || !currentUser) return;

    const messageData = {
      text: input,
      senderId: currentUser.uid,
      timestamp: serverTimestamp(),
      id: uuidv4(),
    };
    
    setInput('');

    const messagesColRef = collection(firestore, 'chats', chatId, 'messages');

    // Non-blocking write with detailed error handling
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
    <div className="flex flex-col h-full bg-card">
      <CardHeader className="flex flex-row justify-between items-center p-4 border-b bg-foreground text-background rounded-t-2xl">
        <CardTitle asChild>
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarImage src={lawyer.imageUrl} />
                <AvatarFallback>{lawyer.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h3 className="text-lg font-bold truncate">{lawyer.name}</h3>
          </div>
        </CardTitle>
        {onClose && (
            <button onClick={onClose} className="text-background/70 hover:text-white">
                <X className="w-6 h-6" />
            </button>
        )}
      </CardHeader>
      
      <div className="flex-grow flex flex-col min-h-0">
          <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 && !initialChatMessage ? (
                <div className="flex justify-center items-center h-full">
                    <p className="text-muted-foreground text-sm text-center px-4">
                        เริ่มต้นการสนทนากับคุณ {lawyer.name.split(' ')[1]}
                    </p>
                </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
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
                      className={`max-w-xs lg:max-w-sm rounded-lg px-3 py-2 shadow-sm ${
                        msg.senderId === currentUser.uid
                          ? 'bg-foreground text-background'
                          : 'bg-secondary'
                      }`}
                    >
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="p-4 border-t bg-gray-50 rounded-b-lg">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="พิมพ์ข้อความของคุณ..."
                disabled={isLoading || !chatId}
                className="flex-grow"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !chatId || !input.trim()}
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
          </div>
        </div>
    </div>
  );
}
