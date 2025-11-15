
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { LawyerProfile } from '@/lib/types';

interface ChatContextType {
  isAiChatOpen: boolean;
  setAiChatOpen: (isOpen: boolean) => void;
  // Deprecated properties for the old pop-up chat
  isLawyerChatOpen: boolean;
  activeLawyer: LawyerProfile | null;
  openLawyerChat: (lawyer: LawyerProfile) => void;
  closeLawyerChat: () => void;
  // Properties for new chat flow
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
    // This function is now deprecated in favor of the full-page chat
    setActiveLawyer(lawyer);
    setIsLawyerChatOpen(true);
  };

  const closeLawyerChat = () => {
    // This function is now deprecated
    setIsLawyerChatOpen(false);
    setActiveLawyer(null);
    setInitialChatMessage('');
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
