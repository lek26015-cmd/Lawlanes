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
import { Send, Sparkles, X, Loader2, Image as ImageIcon, Trash2, ChevronDown, ChevronUp, Plus, Lightbulb, ChevronRight } from 'lucide-react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleQuickQuestion = (question: string) => {
    setInput(question);
    // Focus the textarea and adjust height
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
      }
    }, 100);
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

  const renderStyledText = (text: string) => {
    if (!text.includes('LAlin')) return text;
    const parts = text.split(/(LAlin)/g);
    return parts.map((part, i) => {
      if (part === 'LAlin') {
        return (
          <span key={i} className="inline-flex font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent px-[1px]">
            LAlin
          </span>
        );
      }
      return part;
    });
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
        let responseText = '';
        
        // Detect if it's a contract or just a general image description
        const isContract = data.employer || (data.price > 0) || (data.riskyTerms && data.riskyTerms.length > 0);

        if (isContract) {
          responseText = `ดิฉันวิเคราะห์ข้อมูลจากรูปภาพสัญญาให้แล้วค่ะ:\n\n`;
          if (data.employer) responseText += `**คู่สัญญา:** ${data.employer}\n`;
          if (data.task) responseText += `**รายละเอียด:** ${data.task}\n`;
          if (data.price > 0) responseText += `**มูลค่า:** ${data.price.toLocaleString()} บาท ${data.deposit > 0 ? `(มัดจำ ${data.deposit.toLocaleString()})` : ''}\n`;
          if (data.deadline) responseText += `**กำหนดการ:** ${data.deadline}\n`;
          
          if (data.missingInfo && data.missingInfo.length > 0) {
            responseText += `\n⚠️ **ข้อมูลที่ควรตรวจสอบเพิ่ม:**\n${data.missingInfo.map((info: string) => `- ${info}`).join('\n')}`;
          }

          if (data.riskyTerms && data.riskyTerms.length > 0) {
            responseText += `\n\n⛔️ **จุดที่ควรระวัง:**\n${data.riskyTerms.map((term: string) => `- ${term}`).join('\n')}\n\n💡 แนะนำให้ปรึกษาทนายความเพื่อความรอบคอบสูงสุดนะคะ`;
          } else {
            responseText += `\n\n✅ **ภาพรวมเบื้องต้นดูเรียบร้อยดีค่ะ** หากต้องการความมั่นใจเพิ่มขึ้น สามารถปรึกษาทนายความผ่านระบบได้เลยนะคะ`;
          }
        } else {
          // General image fallback
          responseText = `ดิฉันวิเคราะห์รูปภาพที่คุณส่งมาให้แล้วค่ะ:\n\n${data.task || 'ไม่พบข้อมูลทางกฎหมายในภาพนี้ค่ะ'}`;
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
          content: "ขออภัยค่ะ เกิดข้อผิดพลาดในการอ่านรูปภาพ โปรดลองใหม่อีกครั้งนะคะ",
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
        className="fixed inset-0 w-full h-full max-w-none translate-x-0 translate-y-0 rounded-none bg-white z-[100] p-0 flex flex-col overflow-hidden transition-all duration-500 ease-in-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 lg:inset-auto lg:bottom-6 lg:right-6 lg:w-[480px] lg:h-[85vh] lg:rounded-2xl lg:border lg:shadow-2xl"
      >
        <DialogHeader className="relative flex flex-row items-center justify-between p-4 lg:py-4 lg:px-6 border-b border-gray-100 bg-white/95 backdrop-blur-md sticky top-0 z-10 text-foreground">
          <div className="flex items-center space-x-3">
            <div className="text-left">
              <DialogTitle asChild>
                <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  LAlin
                </h3>
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                AI Legal Assistant
              </DialogDescription>
            </div>
          </div>
          <button 
            onClick={() => setAiChatOpen(false)} 
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </DialogHeader>

        <ScrollArea className="flex-grow bg-white">
          <div className="max-w-4xl mx-auto w-full p-4 lg:p-8 space-y-8">
            <AnimatePresence>
              {messages.length <= 1 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="py-6 lg:py-12 text-center space-y-4 lg:space-y-8"
                >
                  <div className="space-y-4">
                    <div className="flex justify-center mb-6">
                      <div className="w-16 h-16 rounded-xl shadow-sm overflow-hidden border border-gray-200">
                        <img src="/images/lawslane-LAlin.jpg" alt="LAlin" className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800 px-4 lg:px-0 leading-tight pb-1">
                      {t('welcome')}
                    </h1>
                    <p className="text-muted-foreground text-sm lg:text-base max-w-2xl mx-auto px-6 lg:px-0">
                      {locale.startsWith('th') 
                        ? 'พร้อมช่วยเหลือในทุกประเด็นกฎหมาย ด้วยข้อมูลเชิงลึกที่แม่นยำ'
                        : 'Ready to assist with deep legal insights and precision.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 lg:flex lg:flex-wrap lg:justify-center">
                    {/* Desktop Style (Pills) */}
                    <div className="hidden lg:flex flex-wrap justify-center gap-2 mt-4">
                      {quickQuestions.map(q => (
                        <button
                          key={q.key}
                          onClick={() => handleQuickQuestion(q.label)}
                          disabled={isLoading}
                          className="text-sm px-5 py-2.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 hover:text-gray-900">
                          {q.label}
                        </button>
                      ))}
                    </div>

                    {/* Mobile Style (List Items) */}
                    <div className="flex lg:hidden flex-col w-full px-4 space-y-2 mt-4">
                      {quickQuestions.map(q => (
                        <button
                          key={q.key}
                          onClick={() => handleQuickQuestion(q.label)}
                          disabled={isLoading}
                          className="flex items-center justify-between w-full p-4 bg-white border border-gray-100 rounded-xl active:bg-gray-50 transition-colors group">
                          <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-700 text-left">{q.label}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {messages.slice(messages.length > 1 ? 1 : messages.length).map((msg) => (
              <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 lg:gap-4 max-w-full ${msg.role === 'user' ? 'flex-row-reverse' : 'w-full'}`}>
                  
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm border border-gray-200 bg-white">
                        <img src="/images/lawslane-LAlin.jpg" alt="LAlin" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}

                  <div className={`${msg.role === 'user'
                    ? 'bg-gray-100 text-gray-900 rounded-[24px] px-5 py-3 max-w-[85%] lg:max-w-[75%]'
                    : 'w-full pr-4 pb-2'
                    }`}
                  >
                    {typeof msg.content === 'string' ? (
                      <div className="text-[15px] lg:text-[16px] prose prose-slate max-w-none prose-p:leading-[1.7] prose-a:text-blue-600 prose-a:font-medium prose-pre:bg-gray-50 prose-pre:text-gray-800 prose-pre:border prose-pre:border-gray-200">
                        <ReactMarkdown
                          components={{
                            a: ({ node, ...props }) => {
                              const isInternal = props.href?.startsWith('/');
                              if (isInternal) {
                                return <Link href={props.href || '#'} className="text-blue-600 font-medium hover:underline" onClick={() => setAiChatOpen(false)}>{props.children}</Link>;
                              }
                              return <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline" />;
                            },
                            p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-5 mb-4 my-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 my-2">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : isChatResponse(msg.content) ? (
                      <div className="space-y-5">
                        {msg.content.sections.map((section, index) => (
                          <div key={index} className="pb-1">
                            {section.title && <h4 className="font-semibold text-base lg:text-lg mb-2 text-gray-900">{section.title}</h4>}
                            <div className="text-[15px] lg:text-[16px] prose prose-slate max-w-none prose-p:leading-[1.7] prose-a:text-blue-600 prose-a:font-medium">
                              <ReactMarkdown
                                components={{
                                  a: ({ node, ...props }) => {
                                    const isInternal = props.href?.startsWith('/');
                                    if (isInternal) {
                                      return <Link href={props.href || '#'} className="text-blue-600 font-medium hover:underline" onClick={() => setAiChatOpen(false)}>{props.children}</Link>;
                                    }
                                    return <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline" />;
                                  },
                                  p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                                  ul: ({ children }) => <ul className="list-disc pl-5 mb-4 my-2">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 my-2">{children}</ol>,
                                  li: ({ children }) => <li className="mb-1">{children}</li>,
                                  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                                }}
                              >
                                {section.content}
                              </ReactMarkdown>
                            </div>
                            {section.link && section.linkText && (
                              <div className="mt-4">
                                <Link href={section.link} onClick={() => setAiChatOpen(false)}>
                                  <Button variant="outline" className="rounded-full shadow-sm">
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
              <div className="flex w-full justify-start">
                <div className="flex gap-3 lg:gap-4 w-full">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm border border-gray-200 bg-white">
                      <img src="/images/lawslane-LAlin.jpg" alt="LAlin" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 h-10 px-2 lg:px-0">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </ScrollArea>

        <div className="bg-white border-t safe-bottom">
          <div className="max-w-4xl mx-auto w-full p-2 lg:p-8">
            {selectedImage && (
              <div className="mb-2 ml-4 relative inline-block animate-in fade-in zoom-in duration-200">
                <img src={selectedImage} alt="Selected" className="h-16 w-auto rounded-xl border-2 border-primary/20 object-cover shadow-sm" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md border-2 border-white"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-end space-x-2 bg-gray-50 p-2 lg:p-3 rounded-xl lg:rounded-2xl border border-gray-200 focus-within:border-gray-300 focus-within:bg-white focus-within:shadow-sm transition-all duration-300">
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
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full hover:bg-gray-200 transition-all w-10 h-10 flex-shrink-0 text-gray-500 hover:text-gray-900"
              >
                <Plus className="w-5 h-5" />
              </Button>
              <div className="flex-grow">
                <textarea
                  rows={1}
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    handleInputChange(e as any);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as any);
                    }
                  }}
                  placeholder={selectedImage ? "ถามเพิ่มเติม..." : "คุยกับ LAlin..."}
                  disabled={isLoading}
                  className="w-full px-2 py-2 lg:py-2 bg-transparent border-none focus:ring-0 resize-none max-h-[150px] text-base outline-none placeholder:text-gray-400"
                />
              </div>
              <Button 
                type="submit" 
                size="icon" 
                disabled={isLoading || (!input.trim() && !selectedImage)} 
                className="rounded-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors w-9 h-9 lg:w-10 lg:h-10 flex-shrink-0 flex items-center justify-center border-none"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            </form>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              AI อาจแสดงผลผิดพลาด โปรดตรวจสอบข้อมูลสำคัญอย่างละเอียดเสมอ
            </p>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
