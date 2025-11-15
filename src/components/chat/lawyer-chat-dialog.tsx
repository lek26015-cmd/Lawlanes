'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { useChat } from '@/context/chat-context';
import { LawyerChatBox } from '@/components/chat/lawyer-chat-box';
import { useFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';

export default function LawyerChatDialog() {
  const { isLawyerChatOpen, closeLawyerChat, activeLawyer } = useChat();
  const { auth, firestore } = useFirebase();
  const { data: user } = useUser(auth);

  if (!activeLawyer || !user || !firestore) {
    return null;
  }

  return (
    <Dialog open={isLawyerChatOpen} onOpenChange={closeLawyerChat}>
      <DialogContent 
        className="fixed inset-0 w-full h-full rounded-none sm:inset-auto sm:bottom-6 sm:right-[calc(4rem+24px+1rem)] sm:w-96 sm:h-[70vh] sm:rounded-2xl bg-white shadow-2xl border z-50 p-0 flex flex-col"
        hideCloseButton={true}
        >
        <LawyerChatBox 
          firestore={firestore}
          currentUser={user}
          lawyer={activeLawyer}
          onClose={closeLawyerChat}
        />
      </DialogContent>
    </Dialog>
  );
}
