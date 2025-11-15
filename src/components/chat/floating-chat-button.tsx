'use client';

import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { useChat } from '@/context/chat-context';

export default function FloatingChatButton() {
  const { setAiChatOpen } = useChat();

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-rainbow-border-spin"></div>
          <Button
            onClick={() => setAiChatOpen(true)}
            className="relative w-full h-14 pl-5 pr-6 py-2 bg-foreground hover:bg-foreground/90 text-background rounded-full shadow-lg flex items-center justify-center text-base font-semibold"
            aria-label="Open AI Chat"
          >
            <MessageSquare className="mr-2 h-6 w-6" />
            แชทกับ AI
          </Button>
        </div>
      </div>
    </>
  );
}
