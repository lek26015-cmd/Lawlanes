'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp } from 'lucide-react';
import { Badge } from '../ui/badge';

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
      <DialogContent className="sm:max-w-sm w-full flex flex-col h-[70vh] max-h-[520px] rounded-2xl overflow-hidden fixed bottom-6 right-6 p-0 border-0 shadow-2xl">
        <DialogHeader className="p-4 pb-3 border-b">
          <DialogTitle className="text-lg font-semibold">แชทกับ AI</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {/* Initial Message */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                AI
              </div>
              <div className="bg-secondary rounded-lg p-3 text-sm max-w-xs">
                <p>สวัสดีครับ! ผมคือผู้ช่วย AI ด้านกฎหมายจาก Lawlane มีอะไรให้ผมช่วยวิเคราะห์เบื้องต้นไหมครับ? (นี่คือเวอร์ชั่นสาธิต)</p>
              </div>
            </div>

            {/* Quick Questions */}
            <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">คำถามด่วน:</p>
                <div className="flex flex-wrap gap-2">
                    {quickQuestions.map(q => (
                        <Badge key={q} variant="outline" className="cursor-pointer hover:bg-accent">{q}</Badge>
                    ))}
                </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t">
          <div className="relative w-full">
            <Input
              placeholder="พิมพ์คำถามของคุณ..."
              className="pr-12"
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            >
              <ArrowUp className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
