'use client'

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
            <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="bg-gradient-to-b from-blue-50 to-white px-6 pt-6">
                    <Image
                        src={searchImg}
                        alt={t('imageAlt')}
                        className="w-full max-w-[280px] sm:max-w-[360px] h-auto mx-auto"
                        sizes="(max-width: 640px) 280px, 360px"
                        priority
                    />
                </div>
                <div className="px-6 pb-6 space-y-4">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#0B3979] flex items-center gap-2">
                            <Info className="w-5 h-5 flex-shrink-0" />
                            {t('title')}
                        </DialogTitle>
                        <DialogDescription asChild>
                            <ul className="space-y-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 text-left">
                                {Array.from({ length: NOTICE_ITEMS }, (_, i) => (
                                    <li key={i}>{t(`item${i + 1}`)}</li>
                                ))}
                            </ul>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
                            <Checkbox
                                checked={dontShowAgain}
                                onCheckedChange={(v) => setDontShowAgain(v === true)}
                            />
                            {t('dontShowAgain')}
                        </label>
                        <Button
                            onClick={() => handleOpenChange(false)}
                            className="rounded-full bg-[#0B3979] hover:bg-[#082a5a] text-white px-6"
                        >
                            {t('accept')}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
