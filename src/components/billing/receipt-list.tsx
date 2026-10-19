'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { FileDown, Receipt as ReceiptIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getMyReceiptsAction, getLawyerReceiptsAction } from '@/app/actions/receipt-actions';
import type { ReceiptSummary } from '@/lib/receipts/types';

/**
 * รายการใบเสร็จรับเงิน (ออกในนามทนาย — PLAN-06 รอบ 5) พร้อมปุ่มดาวน์โหลด PDF
 * role="client" = ใบที่ได้รับ · role="lawyer" = ใบที่ออก
 * PDF เปิดผ่าน /api/receipts/[id]/pdf ซึ่งเช็คสิทธิ์ฝั่ง server เอง
 */
export function ReceiptList({
    role,
    limit,
    hideWhenEmpty = false,
    viewAllHref,
    className,
}: {
    role: 'client' | 'lawyer';
    limit?: number;
    hideWhenEmpty?: boolean;
    viewAllHref?: string;
    className?: string;
}) {
    const t = useTranslations('Receipts');
    const locale = useLocale();
    const [receipts, setReceipts] = useState<ReceiptSummary[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        (role === 'lawyer' ? getLawyerReceiptsAction() : getMyReceiptsAction())
            .then(res => { if (!cancelled) setReceipts(res.success ? res.data : []); })
            .catch(() => { if (!cancelled) setReceipts([]); });
        return () => { cancelled = true; };
    }, [role]);

    if (receipts === null) return null;
    if (receipts.length === 0 && hideWhenEmpty) return null;

    const shown = limit ? receipts.slice(0, limit) : receipts;
    const dateLocale = locale === 'th' ? 'th-TH' : locale === 'zh' ? 'zh-CN' : 'en-GB';

    return (
        <div className={cn('space-y-2', className)}>
            {receipts.length === 0 ? (
                <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <ReceiptIcon className="mx-auto h-8 w-8 opacity-20 mb-2" />
                    <p className="text-xs">{t('empty')}</p>
                </div>
            ) : shown.map(r => (
                <div key={r.id} className={cn(
                    'flex items-center justify-between gap-3 p-3 rounded-2xl border',
                    r.status === 'void' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100'
                )}>
                    <div className="min-w-0">
                        <p className="text-[10px] font-mono text-slate-400">{r.receiptNo}</p>
                        <p className="font-semibold text-slate-700 text-sm truncate">
                            {r.description}{r.caseTitle ? ` · ${r.caseTitle}` : ''}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                            {role === 'lawyer' ? (r.payerName || t('unknownPayer')) : r.issuerName}
                            {' · '}
                            {r.paidAt ? new Date(r.paidAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {r.status === 'void' && (
                            <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-200">{t('void')}</Badge>
                        )}
                        <span className="font-bold text-slate-800 text-sm">฿{r.amount.toLocaleString()}</span>
                        <a
                            href={`/api/receipts/${encodeURIComponent(r.id)}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t('download', { no: r.receiptNo })}
                            title={t('download', { no: r.receiptNo })}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        >
                            <FileDown className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            ))}
            {viewAllHref && limit && receipts.length > limit && (
                <div className="text-center pt-1">
                    <Link href={viewAllHref} className="text-xs text-blue-600 hover:underline">
                        {t('viewAll', { count: receipts.length })}
                    </Link>
                </div>
            )}
        </div>
    );
}
