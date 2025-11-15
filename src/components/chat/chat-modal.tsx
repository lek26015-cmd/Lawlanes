'use client';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Sparkles, X } from 'lucide-react';

interface ChatModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const quickQuestions = [
  'ร่างสัญญา',
  'คดีมรดก',
  'จดทะเบียนบริษัท',
  'คดีที่ดิน',
];

export default function ChatModal({ isOpen, onOpenChange }: ChatModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        hideCloseButton={true}
        className="fixed inset-0 w-full h-full rounded-none sm:inset-auto sm:bottom-6 sm:right-6 sm:w-96 sm:h-[70vh] sm:rounded-2xl bg-white shadow-2xl border z-50 p-0 flex flex-col"
      >
        <div className="flex justify-between items-center p-4 border-b bg-primary text-primary-foreground sm:rounded-t-2xl">
            <DialogTitle asChild>
                <h3 className="text-xl font-bold">Lawlane AI Assistant</h3>
            </DialogTitle>
            <button onClick={() => onOpenChange(false)} className="text-primary-foreground/70 hover:text-white">
                <X className="w-6 h-6" />
            </button>
        </div>

        <ScrollArea className="flex-grow p-4">
          <div className="space-y-4">
            <div className="flex">
                <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
                        <Sparkles className="w-5 h-5" />
                    </div>
                </div>
                <div className="ml-3">
                    <div className="bg-secondary p-3 rounded-lg shadow-sm" style={{borderTopLeftRadius: 0}}>
                        <p className="text-sm text-secondary-foreground">
                            สวัสดีครับ! ผมคือผู้ช่วย AI ด้านกฎหมายจาก Lawlane มีอะไรให้ผมช่วยวิเคราะห์เบื้องต้นไหมครับ? (นี่คือเวอร์ชันสาธิต)
                        </p>
                    </div>
                </div>
            </div>
          </div>
        </ScrollArea>
        
        <div className="p-3 border-t bg-secondary/30">
            <p className="text-xs font-semibold text-muted-foreground mb-2 ml-1">คำถามด่วน:</p>
            <div className="flex flex-wrap gap-2">
                {quickQuestions.map(q => (
                    <button key={q} className="text-xs px-3 py-1 bg-white border border-border rounded-full hover:bg-accent transition">{q}</button>
                ))}
            </div>
        </div>

        <div className="p-4 border-t bg-white sm:rounded-b-2xl">
            <div className="flex items-center space-x-2">
                <Input
                  placeholder="พิมพ์คำถามของคุณ..."
                  className="flex-grow px-4 py-3 rounded-full bg-secondary/50 border-2 border-transparent focus:bg-white focus:border-primary transition outline-none"
                />
                <Button type="submit" size="icon" className="p-3 rounded-full bg-primary text-white hover:bg-primary/90 transition shadow-lg w-11 h-11">
                    <Send className="w-5 h-5" />
                </Button>
            </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
