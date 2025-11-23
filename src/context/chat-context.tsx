
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { LawyerProfile } from '@/lib/types';

interface ChatContextType {
  isAiChatOpen: boolean;
  setAiChatOpen: (isOpen: boolean) => void;
  initialPrompt: string;
  setInitialPrompt: (prompt: string) => void;
  initialChatMessage: string;
  setInitialChatMessage: (message: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [isAiChatOpen, setAiChatOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState('');
  const [initialChatMessage, setInitialChatMessage] = useState('');

  return (
    <ChatContext.Provider
      value={{
        isAiChatOpen,
        setAiChatOpen,
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
