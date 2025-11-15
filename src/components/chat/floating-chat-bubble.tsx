'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import ChatModal from './chat-modal';
import { cn } from '@/lib/utils';

export default function FloatingChatBubble() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative group">
          <div
            className={cn(
              "absolute -inset-0.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-300",
            )}
          />
          <Button
            size="lg"
            className="relative rounded-full px-6 h-14 shadow-lg text-lg"
            onClick={() => setIsChatOpen(true)}
            aria-label="Open AI Legal Advisor"
          >
            <MessageCircle className="h-6 w-6 mr-3" />
            <span className="font-semibold">แชทกับ AI</span>
          </Button>
        </div>
      </div>
      <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
}
