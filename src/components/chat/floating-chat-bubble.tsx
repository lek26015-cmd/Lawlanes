'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import ChatModal from './chat-modal';
import { cn } from '@/lib/utils';

export default function FloatingChatBubble() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAgreed, setDisclaimerAgreed] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('disclaimerAgreed') === 'true' : false
  );

  const handleToggleChat = () => {
    if (isChatOpen) {
      setIsChatOpen(false);
    } else if (disclaimerAgreed) {
      setIsChatOpen(true);
    } else {
      setShowDisclaimer(true);
    }
  };

  const handleDisclaimerAgree = () => {
    localStorage.setItem('disclaimerAgreed', 'true');
    setDisclaimerAgreed(true);
    setShowDisclaimer(false);
    setIsChatOpen(true);
  };
  
  const handleDisclaimerCancel = () => {
    setShowDisclaimer(false);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative group">
          <div
            className={cn(
              "absolute -inset-1.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 rounded-full blur-lg opacity-75 group-hover:opacity-100 transition duration-300",
              isChatOpen ? "" : "animate-pulse"
            )}
          />
          <Button
            size="icon"
            className="relative rounded-full h-16 w-16 shadow-lg"
            onClick={handleToggleChat}
            aria-label="Toggle AI Legal Assistant"
          >
            {isChatOpen ? <X className="h-7 w-7" /> : <MessageCircle className="h-7 w-7" />}
          </Button>
        </div>
      </div>
      <ChatModal 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        showDisclaimer={showDisclaimer}
        onDisclaimerAgree={handleDisclaimerAgree}
        onDisclaimerCancel={handleDisclaimerCancel}
      />
    </>
  );
}
