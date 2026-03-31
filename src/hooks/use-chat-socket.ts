import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { HumanChatMessage } from '@/lib/types';
import * as crypto from '@/lib/crypto-utils';

const WORKER_URL = process.env.NEXT_PUBLIC_CHAT_WORKER_URL || '';

export function useChatSocket(chatId: string, userId: string, userName: string) {
  const { firestore } = useFirebase();
  const [messages, setMessages] = useState<HumanChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const socketRef = useRef<WebSocket | null>(null);
  const keysRef = useRef<{ public: CryptoKey | null; private: CryptoKey | null }>({ public: null, private: null });
  const recipientPublicKeyRef = useRef<CryptoKey | null>(null);

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

        // Ensure worker has our public key
        if (WORKER_URL) {
          try {
            await fetch(`${WORKER_URL}/key/${userId}`, {
              method: 'POST',
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
    if (!chatId || !keysRef.current.private) return;

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
               // Try to decrypt if it looks like hybrid ciphertext
               if (msg.text.startsWith("[E2EE-v2]")) {
                  const encryptedData = msg.text.replace("[E2EE-v2]", "");
                  const decrypted = await crypto.decryptHybrid(encryptedData, userId, keysRef.current.private!);
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
  }, [chatId, userId, keysRef.current.private]);

  // 2.5 Firestore Fallback (Real-time listener for messages subcollection)
  useEffect(() => {
    if (!chatId || !firestore) return;

    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fbMessages = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        let text = data.text;

        // Decrypt if needed
        if (text.startsWith("[E2EE-v2]") && keysRef.current.private) {
          try {
            const encryptedData = text.replace("[E2EE-v2]", "");
            text = await crypto.decryptHybrid(encryptedData, userId, keysRef.current.private);
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

      setMessages((prev) => {
        // Merge without duplicates, prioritizing Firestore as it's the source of truth for persistence
        const merged = [...prev];
        fbMessages.forEach(newMsg => {
          const index = merged.findIndex(m => m.id === newMsg.id);
          if (index === -1) {
            merged.push(newMsg);
          } else {
            merged[index] = newMsg;
          }
        });
        // Sort by timestamp
        return merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      });
      
      setIsLoading(false);
    }, (error) => {
      console.warn("Firestore messages listener error:", error);
    });

    return () => unsubscribe();
  }, [chatId, firestore, userId, keysRef.current.private]);

  // 3. WebSocket Connection
  useEffect(() => {
    if (!chatId || !userId || !WORKER_URL || !keysRef.current.private) return;

    const wsUrl = `${WORKER_URL.replace('https', 'wss')}/ws/${chatId}?userId=${userId}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          let text = data.text;
          if (text.startsWith("[E2EE-v2]")) {
             const encryptedData = text.replace("[E2EE-v2]", "");
             text = await crypto.decryptHybrid(encryptedData, userId, keysRef.current.private!);
          } else if (text.startsWith("[E2EE]")) {
             // Backward compatibility for v1 (optional)
             const ciphertext = text.replace("[E2EE]", "");
             // Note: v1 only supported recipient decryption in my previous partial code, 
             // but if we want to be safe, we just handle it or show an error.
          }

          setMessages((prev) => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, { ...data, text }];
          });
        }
      } catch (err) {
        console.error('Error parsing/decrypting WS message:', err);
      }
    };
    ws.onclose = () => setIsConnected(false);
    return () => ws.close();
  }, [chatId, userId, keysRef.current.private]);

  const sendMessage = useCallback(async (text: string, recipientId: string) => {
    let finalMessage = text;
    
    // 1. Encrypt message if keys are available
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

    // 2. Try WebSocket send first for real-time
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'message',
        chatId,
        text: finalMessage,
        senderName: userName,
        recipientId
      };
      socketRef.current.send(JSON.stringify(payload));
    } else {
      // 3. Fallback to Server Action (Firestore)
      console.warn("WebSocket not open, falling back to Server Action...");
      try {
        const { sendChatMessageAction } = await import('@/app/actions/chat-actions');
        await sendChatMessageAction({
          chatId,
          text: finalMessage,
          senderId: userId,
          senderName: userName,
          recipientId,
          isLawyerView: window.location.search.includes('view=lawyer') // Simple heuristic
        });
      } catch (err) {
        console.error("Fallback send failed:", err);
      }
    }
  }, [chatId, userName, userId]);

  return { messages, isConnected, isLoading, sendMessage };
}
