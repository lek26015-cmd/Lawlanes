'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import ChatModal from './chat-modal';

export default function FloatingChatButton() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  // This component now only renders the button.
  // The Home component will render the ChatModal conditionally.
  // This avoids re-rendering the entire layout which was causing issues.

  return (
    <>
      {!isChatOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-rainbow-border-spin"></div>
            <Button
              onClick={() => setIsChatOpen(true)}
              className="relative w-full h-14 pl-5 pr-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg flex items-center justify-center text-base font-semibold"
              aria-label="Open AI Chat"
            >
              <MessageSquare className="mr-2 h-6 w-6" />
              แชทกับ AI
            </Button>
          </div>
        </div>
      )}
      <ChatModal isOpen={isChatOpen} onOpenChange={setIsChatOpen} />
    </>
  );
}
