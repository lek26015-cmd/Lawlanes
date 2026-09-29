'use client';

import { useState } from 'react';
import { Check, ChevronDown, Copy, FileText, Gavel, ScrollText } from 'lucide-react';
import type { AiCitation, SourceType } from '@/lib/lawyer-ai/types';
import { cn } from '@/lib/utils';

const TYPE: Record<SourceType, { label: string; icon: typeof ScrollText; badge: string; icon_: string }> = {
    statute: { label: 'ตัวบทกฎหมาย', icon: ScrollText, badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30', icon_: 'text-blue-500' },
    judgment: { label: 'คำพิพากษาฎีกา', icon: Gavel, badge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30', icon_: 'text-violet-500' },
    gazette: { label: 'ราชกิจจานุเบกษา', icon: FileText, badge: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10', icon_: 'text-slate-400' },
    other: { label: 'เอกสารกฎหมาย', icon: FileText, badge: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10', icon_: 'text-slate-400' },
};

export function citationAnchor(messageId: string, n: number) {
    return `cite-${messageId}-${n}`;
}

/** รายการตัวบท/ฎีกาที่ AI ใช้ตอบ — ที่ถูกอ้าง [n] ในคำตอบขึ้นก่อน ที่เหลือพับไว้ */
export function CitationList({ messageId, citations, referenced, open, onToggle }: {
    messageId: string;
    citations: AiCitation[];
    referenced: Set<number>;
    open: Set<number>;
    onToggle: (n: number) => void;
}) {
    const [showOthers, setShowOthers] = useState(false);
    if (citations.length === 0) return null;
    const used = citations.filter(c => referenced.has(c.n));
    const others = citations.filter(c => !referenced.has(c.n));
    // คำตอบไม่ได้อ้างเลข (เช่น ถามทั่วไป) → โชว์ทั้งหมดแบบพับ
    const primary = used.length > 0 ? used : [];
    const secondary = used.length > 0 ? others : citations;

    return (
        <div className="mt-4 space-y-2">
            {primary.length > 0 && (
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">แหล่งอ้างอิง</p>
            )}
            {primary.map(c => <CitationCard key={c.n} messageId={messageId} c={c} open={open.has(c.n)} onToggle={() => onToggle(c.n)} />)}
            {secondary.length > 0 && (
                <div>
                    <button
                        type="button"
                        onClick={() => setShowOthers(v => !v)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showOthers && 'rotate-180')} />
                        {used.length > 0 ? `ตัวบทอื่นที่ค้นเจอ (${secondary.length})` : `ตัวบทที่ค้นเจอในฐานข้อมูล (${secondary.length})`}
                    </button>
                    {showOthers && (
                        <div className="mt-2 space-y-2">
                            {secondary.map(c => <CitationCard key={c.n} messageId={messageId} c={c} open={open.has(c.n)} onToggle={() => onToggle(c.n)} />)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function CitationCard({ messageId, c, open, onToggle }: { messageId: string; c: AiCitation; open: boolean; onToggle: () => void }) {
    const [copied, setCopied] = useState(false);
    const style = TYPE[c.type];
    const Icon = style.icon;
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(`${c.title}\n\n${c.content}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard ถูกบล็อก */ }
    };
    return (
        <div id={citationAnchor(messageId, c.n)} className="scroll-mt-24 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card">
            <div className="flex items-start gap-2">
                <button type="button" onClick={onToggle} aria-expanded={open} className="flex-1 min-w-0 flex items-start gap-2.5 p-3 text-left">
                    <span className="shrink-0 mt-0.5 min-w-6 h-6 px-1.5 rounded-md bg-slate-100 dark:bg-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center">{c.n}</span>
                    <Icon className={cn('w-4 h-4 mt-1 shrink-0', style.icon_)} />
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-foreground leading-snug break-words">{c.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                            <span className={cn('px-2 py-0.5 rounded-full border font-medium', style.badge)}>{style.label}</span>
                            {c.year && <span className="text-slate-500">พ.ศ. {c.year + 543}</span>}
                        </span>
                    </span>
                    <ChevronDown className={cn('w-4 h-4 mt-1 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
                </button>
            </div>
            {open && (
                <div className="px-3 pb-3">
                    <div className="max-h-80 overflow-y-auto rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                        <Excerpt text={c.content} />
                    </div>
                    <button type="button" onClick={copy} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'คัดลอกแล้ว' : 'คัดลอกตัวบท'}
                    </button>
                </div>
            )}
        </div>
    );
}

// ทำหัว "มาตรา ๓๒๖" ให้เด่นและขึ้นบรรทัดใหม่ — ตัวบทที่ติดกันเป็นพืดอ่านยากมาก
function Excerpt({ text }: { text: string }) {
    const parts = text.split(/(มาตรา\s*[๐-๙\d]+(?:\/[๐-๙\d]+)?(?:\s*(?:ทวิ|ตรี|จัตวา))?)/g);
    return (
        <>
            {parts.map((p, i) => {
                if (i % 2 === 0) return <span key={i}>{p}</span>;
                const prev = parts[i - 1];
                // "ตามมาตรา ๓๒๖" / "ในมาตรา ๑๔" คือการอ้างถึง ไม่ใช่หัวมาตราใหม่ — ไม่ต้องขึ้นบรรทัด
                const isReference = /(ตาม|ใน|แห่ง|และ|หรือ|ถึง|ดัง|โดย|,)\s*$/.test(prev) || /^\s*แห่ง/.test(parts[i + 1] ?? '');
                const breakBefore = prev.trim() !== '' && !prev.endsWith('\n') && !isReference;
                return (
                    <span key={i}>
                        {breakBefore ? '\n' : ''}
                        {isReference ? p : <strong className="font-semibold text-slate-900 dark:text-white">{p}</strong>}
                    </span>
                );
            })}
        </>
    );
}
