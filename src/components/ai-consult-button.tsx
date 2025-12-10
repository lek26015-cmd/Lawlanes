'use client';

import { Button } from '@/components/ui/button';
import { useChat } from '@/context/chat-context';

export default function AiConsultButton() {
    const { setAiChatOpen } = useChat();

    return (
        <Button
            size="lg"
            variant="outline"
            className="bg-transparent text-white border-white hover:bg-white/10 hover:text-white text-lg"
            onClick={() => setAiChatOpen(true)}
        >
            ปรึกษา AI ทนายความ
        </Button>
    );
}
