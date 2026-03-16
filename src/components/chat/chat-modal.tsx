'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Sparkles, X, Loader2, Image as ImageIcon, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { chat, type ChatResponse } from '@/ai/flows/chat-flow';
import type { ChatMessage } from '@/lib/types';
import { z } from 'zod';
import { useChat } from '@/context/chat-context';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations, useLocale } from 'next-intl';
import ReactMarkdown from 'react-markdown';

const ChatRequestSchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      content: z.array(z.object({ text: z.string() })),
    })
  ),
  prompt: z.string(),
  locale: z.string().optional(),
});

const isChatResponse = (content: any): content is ChatResponse => {
  return content && Array.isArray(content.sections) && content.sections.every((s: any) => typeof s.title === 'string' && typeof s.content === 'string');
}

export default function ChatModal() {
  const { isAiChatOpen, setAiChatOpen, initialPrompt, setInitialPrompt } = useChat();
  const t = useTranslations('ChatModal');
  const locale = useLocale();

  const quickQuestions = [
    { key: 'contract', label: t('quickQuestions.contract') },
    { key: 'inheritance', label: t('quickQuestions.inheritance') },
    { key: 'company', label: t('quickQuestions.company') },
    { key: 'land', label: t('quickQuestions.land') },
  ];

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: t('welcome'),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickQuestionsOpen, setIsQuickQuestionsOpen] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Robust auto-scroll to bottom
  const scrollToBottom = () => {
    // We use a small timeout to ensure the DOM has updated and the images/Markdown have rendered
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isLoading]);

  // Reset welcome message when locale changes
  useEffect(() => {
    setMessages(prev => {
      const newMessages = [...prev];
      if (newMessages.length > 0 && newMessages[0].id === '1') {
        newMessages[0] = {
          ...newMessages[0],
          content: t('welcome')
        };
      }
      return newMessages;
    });
  }, [locale, t]);

  useEffect(() => {
    if (initialPrompt && isAiChatOpen) {
      handleInitialPrompt(initialPrompt);
      setInitialPrompt(''); // Clear the prompt after using it
    }
  }, [initialPrompt, isAiChatOpen]);

  const handleInitialPrompt = async (prompt: string) => {
    setIsLoading(true);
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
    };
    setMessages((prev) => [...prev, userMessage]);
    await processChat(prompt);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleQuickQuestion = async (question: string) => {
    setIsLoading(true);
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
    };
    setMessages((prev) => [...prev, userMessage]);

    await processChat(question);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;

    setIsLoading(true);

    // Handle Image Upload Case (Screenshot to Contract)
    if (selectedImage) {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: input || 'ช่วยวิเคราะห์รูปนี้ให้หน่อยครับ',
      };
      setMessages((prev) => [...prev, userMessage]);

      const imagePayload = selectedImage; // Store current image to send
      const currentInput = input;

      setInput('');
      setSelectedImage(null); // Clear image immediately from UI

      try {
        const response = await fetch('/api/ai/contract-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imagePayload }),
        });

        if (!response.ok) throw new Error('Failed to process image');

        const data = await response.json();

        // Format the AI response
        let responseText = `ผมวิเคราะห์ข้อมูลจากรูปภาพให้แล้วครับ:

**ผู้ว่าจ้าง:** ${data.employer}
**เนื้องาน:** ${data.task}
**ราคา:** ${data.price.toLocaleString()} บาท ${data.deposit > 0 ? `(มัดจำ ${data.deposit.toLocaleString()})` : ''}
**กำหนดส่ง:** ${data.deadline}

`;
        if (data.missingInfo.length > 0) {
          responseText += `\n⚠️ **ข้อมูลที่ขาดหายไป:**\n${data.missingInfo.map((info: string) => `- ${info}`).join('\n')}`;
        }

        if (data.riskyTerms.length > 0) {
          responseText += `\n\n⛔️ **ความเสี่ยงที่พบ:**\n${data.riskyTerms.map((term: string) => `- ${term}`).join('\n')}\n\n⚠️ แนะนำให้ปรึกษาทนายความเพื่อตรวจทานสัญญาครับ`;
        } else {
          responseText += `\n\n✅ **ร่างสัญญาเบื้องต้นดูครบถ้วนดีครับ** หากต้องการให้ทนายตรวจทานอีกครั้งเพื่อความชัวร์ สามารถกดปุ่มปรึกษาทนายได้เลยครับ`;
        }

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: responseText,
        };
        setMessages((prev) => [...prev, assistantMessage]);

      } catch (error) {
        console.error(error);
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "ขออภัยครับ เกิดข้อผิดพลาดในการอ่านรูปภาพ โปรดลองใหม่อีกครั้ง",
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    await processChat(input);
  };

  const processChat = async (prompt: string) => {
    try {
      const history = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
        content: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }],
      }));

      const request: z.infer<typeof ChatRequestSchema> = { history, prompt, locale };
      const response = await chat(request);

      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error processing chat:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: t('error'),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Dialog open={isAiChatOpen} onOpenChange={setAiChatOpen}>
      <DialogContent
        hideCloseButton={true}
        className="fixed inset-0 w-full h-full max-w-none translate-x-0 translate-y-0 rounded-none sm:rounded-none lg:inset-auto lg:top-[50%] lg:left-[50%] lg:translate-x-[-50%] lg:translate-y-[-50%] lg:w-[90vw] lg:max-w-5xl lg:h-[85vh] lg:rounded-3xl bg-white shadow-2xl border z-50 p-0 flex flex-col overflow-hidden transition-all duration-500 ease-in-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      >
        <DialogHeader className="flex flex-row justify-between items-center p-4 lg:p-6 border-b bg-foreground text-background sm:rounded-t-none lg:rounded-t-3xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle asChild>
                <h3 className="text-xl lg:text-2xl font-bold tracking-tight">{t('title')}</h3>
              </DialogTitle>
              <DialogDescription className="text-white/60 text-xs hidden lg:block">
                Powered by Lawslane Intelligence
              </DialogDescription>
            </div>
          </div>
          <button onClick={() => setAiChatOpen(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-7 h-7" />
          </button>
        </DialogHeader>

        <ScrollArea className="flex-grow bg-gray-50/50">
          <div className="max-w-4xl mx-auto w-full p-4 lg:p-8 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 mr-3">
                    <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shadow-md">
                      <Sparkles className="w-5 h-5" />
                    </div>
                  </div>
                )}
                <div className={`${msg.role === 'user' ? 'w-full flex justify-end' : 'w-full'}`}>
                  <div className={`p-4 lg:p-5 rounded-2xl lg:rounded-3xl shadow-sm ${msg.role === 'user'
                    ? 'bg-foreground text-background ml-auto max-w-[85%] lg:max-w-[75%]'
                    : 'bg-white border mr-auto max-w-[95%] lg:max-w-[85%]'
                    }`}
                    style={msg.role === 'user' 
                      ? { borderTopRightRadius: '4px' } 
                      : { borderTopLeftRadius: '4px' }
                    }
                  >
                    {typeof msg.content === 'string' ? (
                      <div className="text-sm lg:text-base prose prose-sm lg:prose-base max-w-none prose-a:text-blue-600 prose-a:font-semibold prose-a:no-underline hover:prose-a:underline">
                        <ReactMarkdown
                          components={{
                            a: ({ node, ...props }) => {
                              const isInternal = props.href?.startsWith('/');
                              if (isInternal) {
                                return <Link href={props.href || '#'} className="text-blue-600 font-semibold hover:underline" onClick={() => setAiChatOpen(false)}>{props.children}</Link>;
                              }
                              return <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold hover:underline" />;
                            },
                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : isChatResponse(msg.content) ? (
                      <div className="space-y-3">
                        {msg.content.sections.map((section, index) => (
                          <div key={index} className="pb-2 last:pb-0">
                            {section.title && <h4 className="font-bold text-sm lg:text-base mb-1 text-slate-900 border-l-4 border-primary pl-2">{section.title}</h4>}
                            <div className="text-sm lg:text-base prose prose-sm lg:prose-base max-w-none prose-slate">
                              <ReactMarkdown
                                components={{
                                  a: ({ node, ...props }) => {
                                    const isInternal = props.href?.startsWith('/');
                                    if (isInternal) {
                                      return <Link href={props.href || '#'} className="text-blue-600 font-semibold hover:underline" onClick={() => setAiChatOpen(false)}>{props.children}</Link>;
                                    }
                                    return <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold hover:underline" />;
                                  },
                                  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                                }}
                              >
                                {section.content}
                              </ReactMarkdown>
                            </div>
                            {section.link && section.linkText && (
                              <div className="mt-3">
                                <Link href={section.link} onClick={() => setAiChatOpen(false)}>
                                  <Button variant="default" className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all rounded-xl py-5">
                                    {section.linkText}
                                  </Button>
                                </Link>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex">
                <div className="flex-shrink-0 mr-3">
                  <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shadow-md">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div className="bg-white border p-3 rounded-2xl shadow-sm" style={{ borderTopLeftRadius: 0 }}>
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm text-muted-foreground">{t('thinking')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </ScrollArea>

        <div className="bg-gray-50/50 border-t">
          <div className="max-w-4xl mx-auto w-full">
            <div className="bg-gray-100/50 overflow-hidden transition-all duration-300">
              <button 
                onClick={() => setIsQuickQuestionsOpen(!isQuickQuestionsOpen)}
                className="w-full flex items-center justify-between p-3 lg:p-4 hover:bg-gray-200/50 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-xs lg:text-sm font-semibold text-muted-foreground">{t('quickQuestionsLabel')}</p>
                </div>
                <motion.div
                  animate={{ rotate: isQuickQuestionsOpen ? 0 : 180 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              </button>
              
              <AnimatePresence initial={false}>
                {isQuickQuestionsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 lg:px-4 pb-3 lg:pb-4">
                      <div className="flex flex-wrap gap-2">
                        {quickQuestions.map(q => (
                          <button
                            key={q.key}
                            onClick={() => handleQuickQuestion(q.label)}
                            disabled={isLoading}
                            className="text-xs lg:text-sm px-4 py-1.5 bg-white border border-border rounded-full hover:bg-accent hover:border-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-medium hover:text-primary">
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-4 lg:p-6 border-t bg-white lg:rounded-b-3xl">
              {selectedImage && (
                <div className="mb-3 relative inline-block animate-in fade-in zoom-in duration-200">
                  <img src={selectedImage} alt="Selected" className="h-20 w-auto rounded-xl border-2 border-primary/20 object-cover shadow-md" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-lg border-2 border-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex items-end space-x-3 bg-gray-50 p-2 lg:p-3 rounded-2xl lg:rounded-3xl border-2 border-transparent focus-within:border-primary/20 focus-within:bg-white transition-all duration-300 shadow-sm">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-xl lg:rounded-2xl border-2 border-gray-200 hover:border-primary hover:bg-primary/5 transition-all w-12 h-12 flex-shrink-0"
                >
                  <ImageIcon className="w-6 h-6 text-gray-400 group-hover:text-primary" />
                </Button>
                <div className="flex-grow">
                  <textarea
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      handleInputChange(e as any);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e as any);
                      }
                    }}
                    placeholder={selectedImage ? "ถามเพิ่มเติมเกี่ยวกับรูปนี้..." : t('inputPlaceholder')}
                    disabled={isLoading}
                    className="w-full px-2 py-3 bg-transparent border-none focus:ring-0 resize-none max-h-[120px] text-base lg:text-lg outline-none placeholder:text-gray-400"
                  />
                </div>
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={isLoading} 
                  className="p-3 rounded-xl lg:rounded-2xl bg-foreground text-background hover:bg-foreground/90 transition-all shadow-xl w-12 h-12 flex-shrink-0 group"
                >
                  <Send className="w-6 h-6 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Button>
              </form>
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
