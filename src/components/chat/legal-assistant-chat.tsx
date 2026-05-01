'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConsultExpertCard } from './consult-expert-card';

// Example types for modularity
export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  requiresExpert?: boolean; // Flag to render the ConsultExpertCard
}

export function LegalAssistantChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello, I am your Legal Assistant. How can I help you today?',
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Mock AI Backend Call
    // TODO: Integrate actual Gemini API / RAG here
    try {
      // Simulating API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const lowerInput = userMessage.content.toLowerCase();
      const needsExpert = lowerInput.includes('complex') || lowerInput.includes('sue') || lowerInput.includes('court');

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: needsExpert 
          ? 'Based on your query, this seems like a highly complex legal matter. I can provide general guidance, but you should speak with a human expert.'
          : 'I can certainly help you understand the general legal framework for that. [Mock response from RAG]',
        requiresExpert: needsExpert,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border rounded-2xl shadow-sm overflow-hidden min-h-[500px]">
      {/* Header */}
      <div className="bg-slate-50 border-b px-4 py-3 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-slate-800">Legal Assistant</h3>
      </div>

      {/* Message History */}
      <ScrollArea className="flex-1 p-4 bg-slate-50/50">
        <div className="space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${
                msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
                  msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-white border text-indigo-600'
                }`}
              >
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-2 w-full">
                <div
                  className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-white border text-slate-800 rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Consult Expert Card Logic */}
                {msg.role === 'assistant' && msg.requiresExpert && (
                  <ConsultExpertCard />
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 mr-auto max-w-[85%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border text-indigo-600 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="px-4 py-4 rounded-2xl bg-white border rounded-tl-sm shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 bg-white border-t">
        <form onSubmit={handleSend} className="relative flex items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your legal question..."
            className="pr-12 py-6 rounded-xl border-slate-200 focus-visible:ring-indigo-500 shadow-sm"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
