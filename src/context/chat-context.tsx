
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { LawyerProfile } from '@/lib/types';

interface ChatContextType {
  isAiChatOpen: boolean;
  setAiChatOpen: (isOpen: boolean) => void;
  isLawyerChatOpen: boolean;
  activeLawyer: LawyerProfile | null;
  openLawyerChat: (lawyer: LawyerProfile) => void;
  closeLawyerChat: () => void;
  initialPrompt: string;
  setInitialPrompt: (prompt: string) => void;
  initialChatMessage: string;
  setInitialChatMessage: (message: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [isAiChatOpen, setAiChatOpen] = useState(false);
  const [isLawyerChatOpen, setIsLawyerChatOpen] = useState(false);
  const [activeLawyer, setActiveLawyer] = useState<LawyerProfile | null>(null);
  const [initialPrompt, setInitialPrompt] = useState('');
  const [initialChatMessage, setInitialChatMessage] = useState('');


  const openLawyerChat = (lawyer: LawyerProfile) => {
    setActiveLawyer(lawyer);
    setIsLawyerChatOpen(true);
  };

  const closeLawyerChat = () => {
    setIsLawyerChatOpen(false);
    setActiveLawyer(null);
    setInitialChatMessage(''); // Clear message when chat is closed
  };

  return (
    <ChatContext.Provider
      value={{
        isAiChatOpen,
        setAiChatOpen,
        isLawyerChatOpen,
        activeLawyer,
        openLawyerChat,
        closeLawyerChat,
        initialPrompt,
        setInitialPrompt,
        initialChatMessage,
        setInitialChatMessage,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
