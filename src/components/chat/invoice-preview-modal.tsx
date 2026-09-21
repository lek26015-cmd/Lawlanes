'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { FileText, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoicePreviewModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    invoiceData: any;
    chatId: string;
    isLawyerView: boolean;
}

export function InvoicePreviewModal({ isOpen, onOpenChange, invoiceData, chatId, isLawyerView }: InvoicePreviewModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md w-[95vw] rounded-3xl p-6 bg-white dark:bg-slate-900 border-none shadow-2xl">
            <DialogHeader>
                <DialogTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" /> ใบเสนอราคา / แจ้งหนี้
                </DialogTitle>
            </DialogHeader>
            {invoiceData && (
                <div className="space-y-4 mt-2">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-2">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{invoiceData.title || invoiceData.description}</p>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-lg font-black text-blue-600">฿{(invoiceData.amount || 0).toLocaleString()}</p>
                            </div>
                            <div>
                                <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold", invoiceData.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                                    {invoiceData.status === 'paid' ? 'ชำระแล้ว' : 'รอชำระ'}
                                </span>
                            </div>
                        </div>
                    </div>
                    {invoiceData.status !== 'paid' && !isLawyerView && (
                        <div className="pt-2">
                            <Button className="w-full rounded-2xl h-12 font-bold bg-blue-600 hover:bg-blue-700" asChild>
                                <a href={`/payment?chatId=${chatId}&type=case&amount=${invoiceData.amount}`}>
                                    <CreditCard className="w-4 h-4 mr-2" /> ไปหน้าชำระเงิน
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </DialogContent>
      </Dialog>
    );
}
