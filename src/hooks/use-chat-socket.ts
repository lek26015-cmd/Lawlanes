import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { HumanChatMessage } from '@/lib/types';
import * as crypto from '@/lib/crypto-utils';

const WORKER_URL = process.env.NEXT_PUBLIC_CHAT_WORKER_URL || '';

export function useChatSocket(chatId: string, userId: string, userName: string) {
  const { firestore, user: authUser } = useFirebase();
  const [messages, setMessages] = useState<HumanChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Keys stored in state so useEffect can properly react to key generation
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);
  // Refs mirror the state for use inside stable callbacks (sendMessage) to avoid stale closures
  const keysRef = useRef<{ public: CryptoKey | null; private: CryptoKey | null }>({ public: null, private: null });
  const recipientPublicKeyRef = useRef<CryptoKey | null>(null);
  const prevMessageCountRef = useRef<number>(0);

  // Helper for notification sound
  const playNotificationSound = useCallback(() => {
    try {
      // A subtle "pop" sound for chat notifications
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
      audio.volume = 0.4;
      audio.play().catch(() => { /* Ignore autoplay blocks */ });
    } catch (e) {
      console.warn("Failed to play notification sound", e);
    }
  }, []);

  // 1. Key Lifecycle & Initialization
  useEffect(() => {
    if (!userId) return;

    const initKeys = async () => {
      try {
        let pubBase64 = localStorage.getItem(`chat_pub_${userId}`);
        let privBase64 = localStorage.getItem(`chat_priv_${userId}`);

        let pubKey, privKey;

        if (!pubBase64 || !privBase64) {
          const pair = await crypto.generateChatKeyPair();
          pubKey = pair.publicKey;
          privKey = pair.privateKey;
          
          pubBase64 = await crypto.exportPublicKey(pubKey);
          privBase64 = await crypto.exportPrivateKey(privKey);
          
          localStorage.setItem(`chat_pub_${userId}`, pubBase64);
          localStorage.setItem(`chat_priv_${userId}`, privBase64);
        } else {
          pubKey = await crypto.importPublicKey(pubBase64);
          privKey = await crypto.importPrivateKey(privBase64);
        }

        keysRef.current = { public: pubKey, private: privKey };
        // Update state to trigger dependent useEffects
        setPrivateKey(privKey);
        setPublicKey(pubKey);

        // Ensure worker has our public key
        if (WORKER_URL) {
          try {
            await fetch(`${WORKER_URL}/key/${userId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, publicKey: pubBase64 })
            }).catch(e => console.warn("Worker key registration skipped (unreachable)"));
          } catch (err) {
            console.error("Worker unavailable for key registration:", err);
          }
        }

      } catch (err) {
        console.error("E2EE Initialization failed:", err);
      }
    };

    initKeys();
  }, [userId]);

  // 2. Fetch History and Decrypt
  useEffect(() => {
    if (!chatId || !privateKey) return;

    const fetchAndDecryptHistory = async () => {
      try {
        if (WORKER_URL) {
          const response = await fetch(`${WORKER_URL}/history/${chatId}`).catch(e => {
            console.warn("Worker history fetch skipped (unreachable)");
            return null;
          });
          if (response && response.ok) {
            const history = await response.json();
            const decryptedHistory = await Promise.all(history.map(async (msg: any) => {
               if (msg.text.startsWith("[E2EE-v2]")) {
                  const encryptedData = msg.text.replace("[E2EE-v2]", "");
                  const decrypted = await crypto.decryptHybrid(encryptedData, userId, privateKey!);
                  return { ...msg, text: decrypted };
               }
               return msg;
            }));
            setMessages(decryptedHistory);
          }
        }
      } catch (err) {
        console.error('Failed to fetch/decrypt chat history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndDecryptHistory();
  }, [chatId, userId, privateKey]);

  // 2.5 Firestore Fallback (Real-time listener for messages subcollection)
  useEffect(() => {
    if (!chatId || !firestore) return;

    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return; // Ignore optimistic local updates

      const fbMessages = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        let text = data.text;

        if (text.startsWith("[E2EE-v2]") && privateKey) {
          try {
            const encryptedData = text.replace("[E2EE-v2]", "");
            text = await crypto.decryptHybrid(encryptedData, userId, privateKey);
          } catch (err) {
            console.warn("Failed to decrypt Firestore message:", err);
          }
        }

        return {
          id: doc.id,
          text: text,
          senderId: data.senderId,
          timestamp: data.timestamp?.toMillis() || Date.now(),
          type: 'message'
        } as HumanChatMessage;
      }));

      if (fbMessages.length > prevMessageCountRef.current) {
          // Play sound if new message arrived from partner
          const lastMsg = fbMessages[fbMessages.length - 1];
          if (lastMsg.senderId !== userId) {
            playNotificationSound();
          }
      }
      prevMessageCountRef.current = fbMessages.length;

      setMessages((prev) => {
        const merged = [...prev];
        fbMessages.forEach(newMsg => {
          const index = merged.findIndex(m => m.id === newMsg.id);
          if (index === -1) {
            merged.push(newMsg);
          } else {
            merged[index] = newMsg;
          }
        });
        return merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      });
      
      setIsLoading(false);
    }, (error) => {
      console.warn("Firestore messages listener error:", error);
    });

    return () => unsubscribe();
  }, [chatId, firestore, userId, privateKey, playNotificationSound]);

  // 3. WebSocket Connection
  useEffect(() => {
    if (!chatId || !userId || !WORKER_URL || !privateKey) return;

    const wsUrl = `${WORKER_URL.replace('https', 'wss')}/ws/${chatId}?userId=${userId}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'typing') {
          if (data.userId !== userId) {
            setIsPartnerTyping(data.isTyping);
          }
          return;
        }

        if (data.type === 'message') {
          let text = data.text;
          if (text.startsWith("[E2EE-v2]")) {
             const encryptedData = text.replace("[E2EE-v2]", "");
             text = await crypto.decryptHybrid(encryptedData, userId, privateKey!);
          }

          setMessages((prev) => {
            if (prev.some(m => m.id === data.id)) return prev;
            // Play sound for real-time messages too if tab is hidden
            if (data.senderId !== userId) playNotificationSound();
            return [...prev, { ...data, text }];
          });
        }
      } catch (err) {
        console.error('Error parsing/decrypting WS message:', err);
      }
    };
    ws.onclose = () => setIsConnected(false);
    return () => ws.close();
  }, [chatId, userId, privateKey, playNotificationSound]);

  const sendTypingEvent = useCallback((isTyping: boolean) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'typing',
        chatId,
        userId,
        isTyping
      }));
    }
  }, [chatId, userId]);

  const sendMessage = useCallback(async (text: string, recipientId: string, isLawyerView: boolean) => {
    let finalMessage = text;
    
    // 1. Encrypt message
    try {
      if (!recipientPublicKeyRef.current && WORKER_URL) {
         try {
           const res = await fetch(`${WORKER_URL}/key/${recipientId}`).catch(e => null);
           if (res && res.ok) {
             const { publicKey: pubBase64 } = await res.json();
             if (pubBase64) {
                recipientPublicKeyRef.current = await crypto.importPublicKey(pubBase64);
             }
           }
         } catch (err) {
           console.error("Failed to fetch recipient key:", err);
         }
      }

      if (recipientPublicKeyRef.current && keysRef.current.public) {
         const publicKeys = {
            [recipientId]: recipientPublicKeyRef.current,
            [userId]: keysRef.current.public
         };
         const encrypted = await crypto.encryptHybrid(text, publicKeys);
         finalMessage = `[E2EE-v2]${encrypted}`;
      }
    } catch (err) {
      console.error("Encryption failed, sending cleartext as fallback:", err);
    }

    // 2. Try WebSocket send
    let wsSuccess = false;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'message',
        chatId,
        text: finalMessage,
        senderName: userName,
        recipientId
      }));
      wsSuccess = true;
    }
    
    // 3. Always invoke Server Action to ensure notifications fire & metadata updates.
    // If WS succeeded, we skip saving the message text duplication.
    try {
      const authToken = authUser ? await authUser.getIdToken() : undefined;
      const { sendChatMessageAction } = await import('@/app/actions/chat-actions');
      await sendChatMessageAction({
        chatId,
        text: finalMessage,
        senderId: userId,
        senderName: userName,
        recipientId,
        isLawyerView,
        authToken,
        skipMessageSave: wsSuccess
      });
    } catch (err) {
      console.error("Action/Notification send failed:", err);
      // If WS failed and Action failed, we throw so UI shows error state
      if (!wsSuccess) throw err;
    }
  }, [chatId, userName, userId]);

  return { 
    messages, 
    isConnected, 
    isLoading, 
    isPartnerTyping, 
    sendMessage, 
    sendTypingEvent 
  };
}
