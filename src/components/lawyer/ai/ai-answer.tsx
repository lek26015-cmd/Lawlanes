'use client';

import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Check, Copy, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DOC_START = '---เอกสาร---';
const DOC_END = '---จบเอกสาร---';

/** โหมดร่างเอกสาร: AI ห่อตัวเอกสารด้วย ---เอกสาร--- … ---จบเอกสาร--- (ดู lib/lawyer-ai/prompts) */
function splitDocument(content: string): { before: string; doc: string | null; after: string } {
    const start = content.indexOf(DOC_START);
    if (start < 0) return { before: content, doc: null, after: '' };
    const rest = content.slice(start + DOC_START.length);
    const end = rest.indexOf(DOC_END);
    // ระหว่างสตรีมยังไม่ถึงบรรทัดปิด — ถือว่าที่เหลือเป็นตัวเอกสาร
    if (end < 0) return { before: content.slice(0, start), doc: rest.trim(), after: '' };
    return { before: content.slice(0, start), doc: rest.slice(0, end).trim(), after: rest.slice(end + DOC_END.length) };
}

/** เลขอ้างอิงที่คำตอบใช้จริง เช่น [1] [2][3] */
export function referencedNumbers(content: string): Set<number> {
    return new Set([...content.matchAll(/\[(\d{1,2})\]/g)].map(m => Number(m[1])));
}

function Markdown({ text, onCite }: { text: string; onCite: (n: number) => void }) {
    // [n] → ลิงก์ #cite-n แล้วให้ตัว render `a` เปลี่ยนเป็นปุ่มเลขอ้างอิง
    const linked = useMemo(() => text.replace(/\[(\d{1,2})\](?!\()/g, '[$1](#cite-$1)'), [text]);
    return (
        <ReactMarkdown
            components={{
                a: ({ href, children }) => {
                    const m = href?.match(/^#cite-(\d+)$/);
                    if (m) {
                        return (
                            <button
                                type="button"
                                onClick={() => onCite(Number(m[1]))}
                                className="mx-0.5 inline-flex items-center justify-center min-w-5 h-5 px-1 align-text-top rounded bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 text-[11px] font-bold hover:bg-blue-200"
                            >
                                {m[1]}
                            </button>
                        );
                    }
                    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{children}</a>;
                },
                h1: ({ children }) => <h3 className="text-base font-bold mt-4 mb-2 text-slate-900 dark:text-foreground">{children}</h3>,
                h2: ({ children }) => <h3 className="text-base font-bold mt-4 mb-2 text-slate-900 dark:text-foreground">{children}</h3>,
                h3: ({ children }) => <h4 className="text-[15px] font-semibold mt-3 mb-1.5 text-slate-900 dark:text-foreground">{children}</h4>,
                p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="my-2 pl-5 list-disc space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="my-2 pl-5 list-decimal space-y-1">{children}</ol>,
                strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>,
                blockquote: ({ children }) => <blockquote className="my-2 border-l-4 border-slate-200 dark:border-white/20 pl-3 text-slate-600 dark:text-slate-400">{children}</blockquote>,
                code: ({ children }) => <code className="px-1 rounded bg-slate-100 dark:bg-white/10 text-[13px]">{children}</code>,
            }}
        >
            {linked}
        </ReactMarkdown>
    );
}

function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Word เปิดไฟล์ HTML ที่ตั้งนามสกุล .doc ได้ตรง ๆ — ไม่ต้องเพิ่ม dependency สร้าง .docx
function downloadWord(doc: string) {
    const body = doc
        .split('\n')
        .map(l => {
            const html = escapeHtml(l.replace(/^#+\s*/, '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
            return html.trim() ? `<p>${html}</p>` : '<p>&nbsp;</p>';
        })
        .join('\n');
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:'TH Sarabun New','Sarabun',sans-serif;font-size:16pt;line-height:1.4}p{margin:0}</style></head><body>${body}</body></html>`;
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ร่างเอกสาร-${new Date().toISOString().slice(0, 10)}.doc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// เลขอ้างอิง [1] ไม่ควรติดไปในเอกสารที่จะส่งจริง (prompt สั่งแล้ว แต่ AI ยังใส่มาบ้าง) — ไม่แตะ [ช่องกรอก]
const stripCitations = (s: string) => s.replace(/\s?\[\d{1,2}\](?!\()/g, '');

function DocumentBlock({ doc: raw, streaming }: { doc: string; streaming: boolean }) {
    const doc = stripCitations(raw);
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(doc.replace(/\*\*(.+?)\*\*/g, '$1'));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard ถูกบล็อก */ }
    };
    return (
        <div className="my-3 rounded-xl border border-slate-200 dark:border-border overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <FileText className="w-4 h-4" />ร่างเอกสาร
                </span>
                {!streaming && (
                    <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" className="h-8" onClick={copy}>
                            {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                            {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                        </Button>
                        <Button type="button" size="sm" className="h-8 bg-[#002f4b] hover:bg-[#00243a]" onClick={() => downloadWord(doc)}>
                            <Download className="w-3.5 h-3.5 mr-1.5" />ดาวน์โหลด Word
                        </Button>
                    </div>
                )}
            </div>
            <div className="px-5 py-4 md:px-8 md:py-6 bg-white dark:bg-card font-serif text-[15px] leading-relaxed whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200">
                {doc.replace(/\*\*(.+?)\*\*/g, '$1')}
            </div>
        </div>
    );
}

export function AiAnswer({ content, streaming, onCite }: { content: string; streaming: boolean; onCite: (n: number) => void }) {
    const { before, doc, after } = splitDocument(content);
    return (
        <div className="text-[15px] text-slate-700 dark:text-slate-300 break-words">
            {before.trim() && <Markdown text={before} onCite={onCite} />}
            {doc !== null && <DocumentBlock doc={doc} streaming={streaming && !after} />}
            {after.trim() && <Markdown text={after} onCite={onCite} />}
        </div>
    );
}
