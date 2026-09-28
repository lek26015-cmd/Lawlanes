'use client'

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Info, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import searchImg from '@/pic/lawslane-search.webp';

const DISMISS_KEY = 'lawslane:verify-notice-dismissed';
const NOTICE_ITEMS = 4;

// ข้อควรทราบก่อนใช้หน้าตรวจสอบทนาย — เปิดหลัง mount เท่านั้น (HTML ที่ Google เห็นไม่มี popup ทับเนื้อหา)
// ติ๊ก "ไม่ต้องแสดงอีก" แล้วจำไว้ในเครื่องผู้ใช้
export function VerifyNoticeDialog() {
    const t = useTranslations('VerifyLawyer.notice');
    const [open, setOpen] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        try {
            if (localStorage.getItem(DISMISS_KEY) === '1') return;
        } catch { /* storage ถูกบล็อก — แสดงตามปกติ */ }
        setOpen(true);
    }, []);

    const handleOpenChange = (next: boolean) => {
        if (!next && dontShowAgain) {
            try {
                localStorage.setItem(DISMISS_KEY, '1');
            } catch { /* ignore */ }
        }
        setOpen(next);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-xl rounded-2xl p-0 overflow-hidden max-h-[92vh] overflow-y-auto bg-[#0B3979] border-[#0B3979] text-white" hideCloseButton>
                <DialogClose className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                </DialogClose>
                {/* พื้นหลังน้ำเงิน CI · ภาพเต็มความกว้าง popup */}
                <div className="px-4 pt-8 sm:px-6">
                    <Image
                        src={searchImg}
                        alt={t('imageAlt')}
                        className="w-full h-auto mx-auto"
                        sizes="(max-width: 640px) 100vw, 576px"
                        priority
                    />
                </div>
                <div className="px-6 pb-6 space-y-4">
                    <DialogHeader>
                        <DialogTitle className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                            <Info className="w-5 h-5 flex-shrink-0" />
                            {t('title')}
                        </DialogTitle>
                        <DialogDescription asChild>
                            <ul className="space-y-2 text-sm sm:text-base text-blue-100 leading-relaxed list-disc pl-5 text-left marker:text-blue-300">
                                {Array.from({ length: NOTICE_ITEMS }, (_, i) => (
                                    <li key={i}>{t(`item${i + 1}`)}</li>
                                ))}
                            </ul>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-blue-100 cursor-pointer">
                            <Checkbox
                                className="border-white data-[state=checked]:bg-white data-[state=checked]:text-[#0B3979]"
                                checked={dontShowAgain}
                                onCheckedChange={(v) => setDontShowAgain(v === true)}
                            />
                            {t('dontShowAgain')}
                        </label>
                        <Button
                            onClick={() => handleOpenChange(false)}
                            className="rounded-full bg-white hover:bg-blue-50 text-[#0B3979] font-semibold px-6"
                        >
                            {t('accept')}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
