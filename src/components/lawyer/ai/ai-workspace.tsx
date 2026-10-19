'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import logoMark from '@/pic/logo-lawslane-transparent-color.png';
import logoMarkWhite from '@/pic/logo-lawslane-transparent-white.png';
import {
    AlertTriangle, ArrowLeft, ArrowUp, Briefcase, Coins, FileSearch, FileText, FolderOpen, Gavel, Loader2, MessageSquare, PanelLeft, Plus, ScrollText, Trash2, X,
} from 'lucide-react';
import { Link } from '@/navigation';
import { cn } from '@/lib/utils';
import { LawyerProLocked, isLockedStatus, type LockedStatus } from '@/components/lawyer/lawyer-pro-locked';
import { AiAnswer, referencedNumbers } from '@/components/lawyer/ai/ai-answer';
import { CitationList, citationAnchor } from '@/components/lawyer/ai/citations';
import { deleteAiThreadAction, getAiThreadAction, getAiWorkspaceAction, readAttachmentAction } from '@/app/actions/lawyer-ai-actions';
import {
    AI_MODES, ATTACHMENT_ACCEPT, ATTACHMENT_MAX_BYTES, MESSAGE_MAX_CHARS,
    type AiAttachment, type AiAudience, type AiCaseFolder, type AiCitation, type AiMessage, type AiMode, type AiStreamEvent, type AiThreadSummary,
} from '@/lib/lawyer-ai/types';
import { AI_CREDIT_COST, type AiCreditStatus } from '@/lib/lawyer-entitlements';

const MODE_ICON = { statute: ScrollText, judgment: Gavel, draft: FileText, contract: FileSearch } as const;

const EXAMPLES = [
    'ลูกหนี้ยืมเงิน 50,000 บาท ไม่มีสัญญากู้ มีแค่แชท LINE ฟ้องได้ไหม',
    'นายจ้างเลิกจ้างโดยไม่บอกล่วงหน้า ลูกจ้างเรียกค่าชดเชยอะไรได้บ้าง',
    'ถูกโพสต์หมิ่นประมาทในเฟซบุ๊ก ต้องแจ้งความภายในกี่วัน',
];

/** เครื่องหมาย Lawslane ในวงกลม — ใช้แทนไอคอน AI ทั่วไป */
function LawslaneMark({ size = 32, className }: { size?: number; className?: string }) {
    return (
        <span
            className={cn('inline-flex items-center justify-center rounded-full bg-white ring-1 ring-slate-200 dark:bg-white/10 dark:ring-white/10 shrink-0', className)}
            style={{ width: size, height: size }}
        >
            <Image src={logoMark} alt="Lawslane" width={size} height={size} className="w-[62%] h-auto" />
        </span>
    );
}

type UiMessage = AiMessage & { streaming?: boolean; error?: string };
type PendingFile = { key: string; name: string; status: 'reading' | 'ready' | 'error'; data?: AiAttachment; error?: string };

const PLACEHOLDER: Record<AiMode, string> = {
    ask: 'ถามคำถาม หรือเล่าข้อเท็จจริงของคดี…',
    statute: 'เล่าข้อเท็จจริง แล้ว AI จะหามาตราที่เกี่ยวข้อง…',
    judgment: 'เล่าข้อเท็จจริงหรือประเด็น เพื่อหาฎีกาที่เทียบเคียงได้…',
    draft: 'เช่น ร่างหนังสือบอกกล่าวทวงถามค่าเช่าค้าง 3 เดือน…',
    contract: 'แนบไฟล์สัญญา (+) หรือวางข้อความสัญญา แล้วบอกว่าเป็นฝ่ายไหน…',
};

const ATTACHMENT_ERROR: Record<string, string> = {
    'too-large': 'ไฟล์ใหญ่เกิน 10 MB',
    unsupported: 'รองรับเฉพาะ PDF, รูปภาพ และ .txt',
    empty: 'อ่านข้อความในไฟล์ไม่ได้',
    'rate-limited': 'แนบไฟล์ถี่เกินไป รอสักครู่',
    'insufficient-credits': 'เครดิต AI ไม่พอสำหรับอ่านไฟล์นี้',
    error: 'อ่านไฟล์ไม่สำเร็จ',
};

const CUSTOMER_PLACEHOLDER: Record<AiMode, string> = {
    ask: 'เล่าเรื่องของคุณ เช่น เพื่อนยืมเงินแล้วไม่คืน ทำอะไรได้บ้าง…',
    statute: 'เล่าเรื่องของคุณ แล้ว AI จะอธิบายว่ากฎหมายมาตราไหนเกี่ยวข้อง…',
    judgment: 'เล่าเรื่องของคุณ เพื่อหาคดีที่ศาลเคยตัดสินในเรื่องคล้ายกัน…',
    draft: 'เช่น ร่างหนังสือทวงถามเงินที่ให้ยืม 30,000 บาท…',
    contract: 'แนบไฟล์สัญญา (+) หรือวางข้อความสัญญา แล้วบอกว่าคุณเป็นฝ่ายไหน…',
};

/** ข้อความที่ต่างกันระหว่างหน้าทนายกับหน้าลูกค้า */
const COPY = {
    lawyer: {
        home: '/lawyer-dashboard',
        homeLabel: 'กลับแดชบอร์ดทนาย',
        subtitle: 'AI ผู้ช่วยงานคดี',
        feature: 'ผู้ช่วย AI งานคดี',
        title: 'ให้ Lawslane AI ช่วยงานคดียังไงดีครับ',
        intro: 'ค้นมาตราและฎีกาจากฐานข้อมูลกฎหมาย ร่างเอกสาร หรือแนบสัญญาให้ตรวจ — เลือกแฟ้มคดีทางซ้ายเพื่อให้ AI รู้บริบทคดี',
        newLabel: 'เริ่มงานใหม่',
        historyLabel: 'งานทั่วไป',
        noCredits: 'เครดิต AI ไม่พอ — เครดิตรายเดือนจะรีเซ็ตต้นเดือนหน้า หรืออัปเกรดแพลนเพื่อรับเครดิตเพิ่ม',
        disclaimer: 'AI อาจผิดพลาดหรืออ้างตัวบทที่ไม่ใช่ฉบับล่าสุด ตรวจสอบก่อนใช้งานจริงทุกครั้ง',
        placeholder: PLACEHOLDER,
    },
    customer: {
        home: '/',
        homeLabel: 'กลับหน้าหลัก Lawslane',
        subtitle: 'AI ผู้ช่วยกฎหมาย',
        feature: 'Lawslane AI',
        title: 'มีเรื่องกฎหมายอะไรให้ช่วยไหมครับ',
        intro: 'เล่าเรื่องของคุณเป็นภาษาปกติ Lawslane AI จะอธิบายกฎหมายที่เกี่ยวข้องพร้อมตัวบทอ้างอิง ช่วยร่างหนังสือ หรืออ่านสัญญาก่อนเซ็นให้',
        newLabel: 'คุยเรื่องใหม่',
        historyLabel: 'ประวัติการคุย',
        noCredits: 'เครดิต AI ของเดือนนี้หมดแล้ว — จะได้เครดิตใหม่ต้นเดือนหน้า',
        disclaimer: 'Lawslane AI ให้ข้อมูลกฎหมายทั่วไป ไม่ใช่คำปรึกษาจากทนายความ และอาจผิดพลาดได้ เรื่องสำคัญควรปรึกษาทนาย',
        placeholder: CUSTOMER_PLACEHOLDER,
    },
} as const;

type Copy = (typeof COPY)[AiAudience];

const STREAM_ERROR: Record<string, string> = {
    'rate-limited': 'ใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',
    'insufficient-credits': 'เครดิต AI ไม่พอ — เครดิตรายเดือนจะรีเซ็ตต้นเดือนหน้า หรืออัปเกรดแพลนเพื่อรับเครดิตเพิ่ม',
    'bad-request': 'ส่งคำถามไม่สำเร็จ (ไม่พบเธรดหรือแฟ้มคดีนี้)',
    error: 'AI ตอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
};

function setUrl(params: Record<string, string | null>) {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(params)) {
        if (v) url.searchParams.set(k, v);
        else url.searchParams.delete(k);
    }
    window.history.replaceState(null, '', url.pathname + url.search);
}

export default function AiWorkspace({ audience = 'lawyer' }: { audience?: AiAudience }) {
    const copy: Copy = COPY[audience];
    const searchParams = useSearchParams();
    const [locked, setLocked] = useState<LockedStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [cases, setCases] = useState<AiCaseFolder[]>([]);
    const [threads, setThreads] = useState<AiThreadSummary[]>([]);
    const [caseId, setCaseId] = useState<string | null>(null);
    const [threadId, setThreadId] = useState<string | null>(null);
    const [messages, setMessages] = useState<UiMessage[]>([]);
    const [loadingThread, setLoadingThread] = useState(false);
    const [mode, setMode] = useState<AiMode>('ask');
    const [input, setInput] = useState('');
    const [files, setFiles] = useState<PendingFile[]>([]);
    const [sending, setSending] = useState(false);
    const [openCites, setOpenCites] = useState<Record<string, Set<number>>>({});
    const [panelOpen, setPanelOpen] = useState(false);
    const [credits, setCredits] = useState<AiCreditStatus | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const autoSent = useRef(false);

    const activeCase = cases.find(c => c.id === caseId) || null;

    const openThread = useCallback(async (id: string) => {
        setLoadingThread(true);
        setPanelOpen(false);
        const res = await getAiThreadAction(audience, id);
        setLoadingThread(false);
        if (res.status === 'ok') {
            setThreadId(res.thread.id);
            setCaseId(res.thread.caseId);
            setMessages(res.messages);
            setOpenCites({});
            setUrl({ thread: res.thread.id, case: null });
        } else if (isLockedStatus(res.status)) {
            setLocked(res.status);
        } else {
            setUrl({ thread: null });
        }
    }, []);

    const newThread = useCallback((forCase: string | null) => {
        setThreadId(null);
        setCaseId(forCase);
        setMessages([]);
        setOpenCites({});
        setPanelOpen(false);
        setUrl({ thread: null, case: forCase });
    }, []);

    // โหลดแฟ้มคดี + เธรด แล้วเปิดตาม URL (?thread= / ?case= / ?mode= / ?q= จากลิงก์เก่าของหน้าค้นหากฎหมาย)
    useEffect(() => {
        (async () => {
            const res = await getAiWorkspaceAction(audience);
            if (res.status !== 'ok') {
                setLocked(res.status);
                setLoading(false);
                return;
            }
            setCases(res.cases);
            setThreads(res.threads);
            setCredits(res.credits);
            setLoading(false);
            const m = searchParams.get('mode') as AiMode | null;
            if (m && AI_MODES.some(x => x.id === m)) setMode(m);
            const t = searchParams.get('thread');
            const c = searchParams.get('case');
            if (t) await openThread(t);
            else if (c && res.cases.some(x => x.id === c)) setCaseId(c);
            const q = searchParams.get('q');
            if (q) setInput(q.slice(0, MESSAGE_MAX_CHARS));
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, [messages.length, messages[messages.length - 1]?.content.length]);

    const addFiles = async (list: FileList | null) => {
        if (!list) return;
        for (const file of Array.from(list).slice(0, 5)) {
            const key = `${file.name}-${file.size}-${Date.now()}`;
            if (file.size > ATTACHMENT_MAX_BYTES) {
                setFiles(f => [...f, { key, name: file.name, status: 'error', error: ATTACHMENT_ERROR['too-large'] }]);
                continue;
            }
            setFiles(f => [...f, { key, name: file.name, status: 'reading' }]);
            const fd = new FormData();
            fd.append('file', file);
            try {
                const res = await readAttachmentAction(audience, fd);
                if (res.status === 'ok') {
                    setFiles(f => f.map(x => x.key === key ? { ...x, status: 'ready', data: res.attachment } : x));
                    if (res.credits) setCredits(res.credits);
                } else if (isLockedStatus(res.status)) {
                    setLocked(res.status);
                } else {
                    setFiles(f => f.map(x => x.key === key ? { ...x, status: 'error', error: ATTACHMENT_ERROR[res.status] || ATTACHMENT_ERROR.error } : x));
                }
            } catch {
                setFiles(f => f.map(x => x.key === key ? { ...x, status: 'error', error: ATTACHMENT_ERROR.error } : x));
            }
        }
    };

    const send = useCallback(async (text: string) => {
        const message = text.trim().slice(0, MESSAGE_MAX_CHARS);
        const ready = files.filter(f => f.status === 'ready' && f.data).map(f => f.data!);
        if ((!message && ready.length === 0) || sending || files.some(f => f.status === 'reading')) return;

        const now = Date.now();
        const userMsg: UiMessage = { id: `u-${now}`, role: 'user', content: message, mode, createdAt: now, attachments: ready.map(a => ({ name: a.name, mimeType: a.mimeType })) };
        const modelId = `m-${now}`;
        setMessages(m => [...m, userMsg, { id: modelId, role: 'model', content: '', mode, createdAt: now, streaming: true }]);
        setInput('');
        setFiles([]);
        setSending(true);

        const patch = (fn: (m: UiMessage) => UiMessage) => setMessages(list => list.map(x => x.id === modelId ? fn(x) : x));
        const fail = (code: string) => {
            if (isLockedStatus(code)) setLocked(code);
            patch(x => ({ ...x, streaming: false, error: code === 'insufficient-credits' ? copy.noCredits : STREAM_ERROR[code] || STREAM_ERROR.error }));
        };

        try {
            const res = await fetch('/api/lawyer-ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audience, threadId, caseId: threadId ? undefined : caseId, mode, message, attachments: ready }),
            });
            if (!res.body) throw new Error('no body');
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finished = false;
            while (!finished) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const l of lines) {
                    if (!l.trim()) continue;
                    const e = JSON.parse(l) as AiStreamEvent;
                    if (e.type === 'thread') {
                        setThreadId(e.threadId);
                        setUrl({ thread: e.threadId, case: null });
                        if (e.title) setThreads(t => [{ id: e.threadId, title: e.title, caseId, updatedAt: Date.now() }, ...t]);
                        else setThreads(t => t.map(x => x.id === e.threadId ? { ...x, updatedAt: Date.now() } : x).sort((a, b) => b.updatedAt - a.updatedAt));
                    } else if (e.type === 'citations') {
                        patch(x => ({ ...x, citations: e.citations }));
                    } else if (e.type === 'delta') {
                        patch(x => ({ ...x, content: x.content + e.text }));
                    } else if (e.type === 'done') {
                        patch(x => ({ ...x, streaming: false }));
                        if (e.credits) setCredits(e.credits);
                        finished = true;
                    } else if (e.type === 'error') {
                        fail(e.code);
                        finished = true;
                    }
                }
            }
            if (!finished) fail('error');
        } catch (err) {
            console.error(err);
            fail('error');
        } finally {
            setSending(false);
        }
    }, [audience, caseId, copy.noCredits, files, mode, sending, threadId]);

    // มาจากลิงก์ "ค้นหากฎหมาย" เดิม (?q=) — ส่งให้เลยครั้งเดียว
    useEffect(() => {
        if (!loading && !locked && !autoSent.current && searchParams.get('q') && input) {
            autoSent.current = true;
            send(input);
        }
    }, [loading, locked, input, searchParams, send]);

    const toggleCite = (messageId: string, n: number, forceOpen = false) => {
        setOpenCites(prev => {
            const s = new Set(prev[messageId] || []);
            if (s.has(n) && !forceOpen) s.delete(n);
            else s.add(n);
            return { ...prev, [messageId]: s };
        });
        if (forceOpen) {
            requestAnimationFrame(() => document.getElementById(citationAnchor(messageId, n))?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        }
    };

    const removeThread = async (id: string) => {
        if (!window.confirm('ลบประวัติการสนทนานี้? ลบแล้วกู้คืนไม่ได้')) return;
        const res = await deleteAiThreadAction(audience, id);
        if (res.status === 'ok' || res.status === 'not-found') {
            setThreads(t => t.filter(x => x.id !== id));
            if (threadId === id) newThread(caseId);
        }
    };

    if (locked) {
        return (
            <div className="h-dvh overflow-y-auto p-4 md:p-8">
                <BackToDashboard href={copy.home} label={copy.homeLabel} className="mb-6" />
                <div className="max-w-2xl mx-auto">
                    {audience === 'customer' ? <CustomerLoginPrompt /> : <LawyerProLocked status={locked} feature={copy.feature} />}
                </div>
            </div>
        );
    }
    if (loading) {
        return <div className="h-dvh flex items-center justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
    }

    const composer = (
        <Composer
            mode={mode}
            setMode={setMode}
            input={input}
            setInput={setInput}
            files={files}
            removeFile={key => setFiles(f => f.filter(x => x.key !== key))}
            addFiles={addFiles}
            sending={sending}
            onSend={() => send(input)}
            compact={messages.length > 0}
            credits={credits}
            copy={copy}
        />
    );

    return (
        <div className="relative flex h-dvh bg-white dark:bg-background overflow-hidden">
            <aside className={cn(
                // สีเดียวกับ sidebar แดชบอร์ดทนาย (lawyer-sidebar.tsx)
                'w-72 shrink-0 bg-[#002f4b] text-white flex-col',
                panelOpen ? 'flex absolute inset-y-0 left-0 z-30 shadow-xl lg:static lg:shadow-none' : 'hidden lg:flex',
            )}>
                <ThreadPanel
                    copy={copy}
                    showCases={audience === 'lawyer'}
                    cases={cases}
                    threads={threads}
                    caseId={caseId}
                    threadId={threadId}
                    onNew={newThread}
                    onOpen={openThread}
                    onDelete={removeThread}
                    onClose={() => setPanelOpen(false)}
                />
            </aside>

            <section className="relative flex-1 min-w-0 flex flex-col">
                <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-100 dark:border-border">
                    <button type="button" onClick={() => setPanelOpen(true)} className="lg:hidden p-1.5 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="แฟ้มคดีและประวัติ">
                        <PanelLeft className="w-5 h-5" />
                    </button>
                    {audience === 'lawyer' && <span className={cn(
                        'min-w-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium truncate',
                        activeCase ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400',
                    )}>
                        {activeCase ? <><FolderOpen className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{activeCase.title}</span></> : 'งานทั่วไป · ไม่ผูกแฟ้มคดี'}
                    </span>}
                    {credits && (
                        <span
                            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 shrink-0"
                            title={credits.monthly !== null ? `เครดิตรายเดือน ${credits.monthly.toLocaleString('th-TH')} · รีเซ็ตต้นเดือน (เวลาไทย)` : undefined}
                        >
                            <Coins className="w-3.5 h-3.5 text-amber-500" />
                            {credits.remaining === null ? 'ไม่จำกัด' : `${credits.remaining.toLocaleString('th-TH')} เครดิต`}
                        </span>
                    )}
                </div>

                {loadingThread ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : messages.length === 0 ? (
                    <div className="flex-1 overflow-y-auto px-4 md:px-8 bg-[radial-gradient(ellipse_at_top,rgba(0,47,75,0.06),transparent_60%)] dark:bg-none">
                        <div className="max-w-3xl mx-auto min-h-full flex flex-col justify-center py-10">
                            <LawslaneMark size={64} className="mx-auto mb-5 shadow-sm" />
                            <h2 className="text-center text-[26px] md:text-4xl font-bold tracking-tight text-slate-900 dark:text-foreground mb-3">
                                {copy.title}
                            </h2>
                            <p className="text-center text-sm md:text-[15px] text-slate-500 max-w-xl mx-auto mb-8 leading-relaxed">
                                {activeCase
                                    ? `AI จะใช้ข้อเท็จจริง พยานหลักฐาน และขั้นตอนงานในแฟ้ม “${activeCase.title}” ประกอบคำตอบ`
                                    : copy.intro}
                            </p>
                            {composer}
                            <div className="mt-8 grid gap-2 sm:grid-cols-3">
                                {EXAMPLES.map(ex => (
                                    <button
                                        key={ex}
                                        type="button"
                                        onClick={() => setInput(ex)}
                                        className="text-left rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3 text-[13px] leading-snug text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:bg-white hover:shadow-sm transition"
                                    >
                                        {ex}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
                            <div className="max-w-3xl mx-auto space-y-8">
                                {messages.map(m => m.role === 'user' ? (
                                    <div key={m.id} className="flex justify-end">
                                        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-foreground px-4 py-2.5">
                                            {m.mode !== 'ask' && <span className="inline-block mb-1 rounded-full bg-white dark:bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-[#002f4b] dark:text-blue-300">{AI_MODES.find(x => x.id === m.mode)?.label}</span>}
                                            {m.content && <p className="whitespace-pre-wrap break-words text-[15px]">{m.content}</p>}
                                            {m.attachments && m.attachments.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {m.attachments.map((a, i) => (
                                                        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 px-2 py-0.5 text-xs"><FileText className="w-3 h-3" />{a.name}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <ModelMessage
                                        key={m.id}
                                        m={m}
                                        open={openCites[m.id] || new Set()}
                                        onToggle={n => toggleCite(m.id, n)}
                                        onCite={n => toggleCite(m.id, n, true)}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="px-4 md:px-8 pb-4 pt-3 bg-gradient-to-t from-white via-white dark:from-background dark:via-background">
                            <div className="max-w-3xl mx-auto">{composer}</div>
                        </div>
                    </>
                )}
            </section>
            {panelOpen && <button type="button" aria-label="ปิด" onClick={() => setPanelOpen(false)} className="lg:hidden fixed inset-0 z-20 bg-black/30" />}
        </div>
    );
}

function CustomerLoginPrompt() {
    return (
        <div className="text-center py-14 px-6 bg-white dark:bg-card rounded-3xl border border-slate-200 dark:border-border shadow-sm">
            <LawslaneMark size={56} className="mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-foreground mb-2">เข้าสู่ระบบเพื่อใช้ Lawslane AI</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-6">ใช้ฟรีทุกเดือนหลังเข้าสู่ระบบ ระบบจะเก็บประวัติการคุยไว้ให้กลับมาดูต่อได้</p>
            <Link href="/login?redirect=%2Fai" className="inline-flex items-center justify-center rounded-full bg-[#002f4b] hover:bg-[#00243a] px-6 py-2.5 text-sm font-semibold text-white">
                เข้าสู่ระบบ / สมัครสมาชิก
            </Link>
        </div>
    );
}

function BackToDashboard({ href, label, className }: { href: string; label: string; className?: string }) {
    return (
        <Link
            href={href}
            className={cn('inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white', className)}
        >
            <ArrowLeft className="w-4 h-4" />{label}
        </Link>
    );
}

function ModelMessage({ m, open, onToggle, onCite }: { m: UiMessage; open: Set<number>; onToggle: (n: number) => void; onCite: (n: number) => void }) {
    const referenced = useMemo(() => referencedNumbers(m.content), [m.content]);
    return (
        <div className="flex gap-3">
            <LawslaneMark size={32} className="mt-0.5" />
            <div className="min-w-0 flex-1">
                {m.content ? (
                    <AiAnswer content={m.content} streaming={!!m.streaming} onCite={onCite} />
                ) : m.streaming ? (
                    <p className="flex items-center gap-2 text-sm text-slate-500 pt-1.5">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {m.citations ? `ค้นเจอ ${m.citations.length} แหล่งอ้างอิง กำลังเรียบเรียงคำตอบ…` : 'กำลังค้นตัวบทและคำพิพากษา…'}
                    </p>
                ) : null}
                {m.error && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="w-4 h-4" />{m.error}</p>
                )}
                {!m.streaming && m.citations && (
                    <CitationList messageId={m.id} citations={m.citations} referenced={referenced} open={open} onToggle={onToggle} />
                )}
            </div>
        </div>
    );
}

function Composer({ mode, setMode, input, setInput, files, removeFile, addFiles, sending, onSend, compact, credits, copy }: {
    mode: AiMode;
    setMode: (m: AiMode) => void;
    input: string;
    setInput: (v: string) => void;
    files: PendingFile[];
    removeFile: (key: string) => void;
    addFiles: (list: FileList | null) => void;
    sending: boolean;
    onSend: () => void;
    compact: boolean;
    credits: AiCreditStatus | null;
    copy: Copy;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const reading = files.some(f => f.status === 'reading');
    const cost = AI_CREDIT_COST[mode];
    const outOfCredits = credits?.remaining !== null && credits !== null && credits.remaining < cost;
    const canSend = !sending && !reading && !outOfCredits && (input.trim() !== '' || files.some(f => f.status === 'ready'));

    const chips = (
        <div className={cn('flex flex-wrap gap-2', compact ? 'mb-2' : 'justify-center mt-5')}>
            {AI_MODES.map(m => (
                <button
                    key={m.id}
                    type="button"
                    title={m.hint}
                    onClick={() => setMode(mode === m.id ? 'ask' : m.id)}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border transition-colors',
                        compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm',
                        mode === m.id
                            ? 'border-[#002f4b] bg-[#002f4b] text-white'
                            : 'border-slate-200 dark:border-border text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5',
                    )}
                >
                    {(() => { const Icon = MODE_ICON[m.id]; return <Icon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />; })()}
                    {m.label}
                </button>
            ))}
        </div>
    );

    return (
        <div>
            {compact && chips}
            <div className="rounded-3xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-[0_10px_40px_-12px_rgba(15,23,42,0.18)] focus-within:border-slate-300 focus-within:shadow-[0_10px_40px_-10px_rgba(0,47,75,0.25)] transition-shadow">
                {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-4 pt-3">
                        {files.map(f => (
                            <span key={f.key} className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs max-w-full',
                                f.status === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-700 dark:bg-white/5 dark:border-white/10 dark:text-slate-300',
                            )}>
                                {f.status === 'reading' ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <FileText className="w-3 h-3 shrink-0" />}
                                <span className="truncate max-w-[12rem]">{f.name}</span>
                                {f.status === 'reading' && <span className="text-slate-400">กำลังอ่าน…</span>}
                                {f.error && <span>· {f.error}</span>}
                                {f.data?.truncated && <span className="text-amber-600">· ยาวเกิน อ่านแค่ส่วนแรก</span>}
                                <button type="button" onClick={() => removeFile(f.key)} aria-label="เอาไฟล์ออก" className="ml-0.5 text-slate-400 hover:text-slate-700"><X className="w-3 h-3" /></button>
                            </span>
                        ))}
                    </div>
                )}
                <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            if (canSend) onSend();
                        }
                    }}
                    maxLength={MESSAGE_MAX_CHARS}
                    rows={compact ? 2 : 3}
                    placeholder={copy.placeholder[mode]}
                    className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-relaxed text-slate-800 dark:text-foreground placeholder:text-slate-400 focus:outline-none max-h-60"
                />
                <div className="flex items-center justify-between px-3 pb-3">
                    <div className="flex items-center gap-1">
                        <input ref={fileRef} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                            aria-label="แนบไฟล์"
                            title="แนบไฟล์ PDF / รูป / .txt (ไม่เกิน 10 MB) · PDF และรูปใช้ไฟล์ละ 1 เครดิต"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                        {mode !== 'ask' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                                {AI_MODES.find(x => x.id === mode)?.label}
                                <button type="button" onClick={() => setMode('ask')} aria-label="ยกเลิกโหมด"><X className="w-3 h-3" /></button>
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onSend}
                        disabled={!canSend}
                        aria-label="ส่ง"
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-[#002f4b] text-white disabled:bg-slate-200 disabled:text-white dark:disabled:bg-white/10 transition-colors"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
                    </button>
                </div>
            </div>
            {!compact && chips}
            <div className={cn('flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]', compact ? 'mt-2' : 'mt-6')}>
                {credits && (
                    <span className={cn('font-medium', outOfCredits ? 'text-red-600' : 'text-slate-500')}>
                        {outOfCredits ? 'เครดิตไม่พอสำหรับงานนี้' : `ครั้งนี้ใช้ ${cost} เครดิต`}
                    </span>
                )}
                <span className="text-slate-400">{copy.disclaimer}</span>
            </div>
        </div>
    );
}

function ThreadPanel({ copy, showCases, cases, threads, caseId, threadId, onNew, onOpen, onDelete, onClose }: {
    copy: Copy;
    showCases: boolean;
    cases: AiCaseFolder[];
    threads: AiThreadSummary[];
    caseId: string | null;
    threadId: string | null;
    onNew: (caseId: string | null) => void;
    onOpen: (id: string) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}) {
    const general = threads.filter(t => !t.caseId);
    const byCase = (id: string) => threads.filter(t => t.caseId === id);

    const ThreadRow = ({ t }: { t: AiThreadSummary }) => (
        <div className={cn('group flex items-center rounded-lg', t.id === threadId ? 'bg-white/15' : 'hover:bg-white/[0.07]')}>
            <button type="button" onClick={() => onOpen(t.id)} className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-white/85 hover:text-white">
                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-white/50" />
                <span className="truncate">{t.title}</span>
            </button>
            <button type="button" onClick={() => onDelete(t.id)} aria-label="ลบ" className="p-1.5 mr-1 rounded text-white/40 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-300">
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between gap-2 px-4 h-16 border-b border-white/10">
                <Link href={copy.home} className="flex items-center gap-2.5 min-w-0">
                    <Image src={logoMarkWhite} alt="Lawslane" width={28} height={28} className="h-7 w-auto" />
                    <span className="flex flex-col leading-none min-w-0">
                        <span className="font-bold text-[17px] text-white">Lawslane</span>
                        <span className="mt-0.5 text-[10px] font-bold tracking-widest text-white/60">{copy.subtitle}</span>
                    </span>
                </Link>
                <button type="button" onClick={onClose} className="lg:hidden p-2 rounded-lg text-white/70 hover:bg-white/10" aria-label="ปิด"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3 space-y-2">
                <button
                    type="button"
                    onClick={() => onNew(null)}
                    className="w-full flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-3.5 py-2.5 text-sm font-medium text-white transition-colors"
                >
                    <Plus className="w-4 h-4" />{copy.newLabel}
                </button>
                {showCases && (
                    <Link href="/lawyer-dashboard/cases" className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm text-white/80 hover:text-white hover:bg-white/[0.07]">
                        <Briefcase className="w-4 h-4" />แฟ้มคดีทั้งหมด
                    </Link>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
                {showCases && <div>
                    <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">แฟ้มคดี</p>
                    {cases.length === 0 ? (
                        <p className="px-2 text-xs text-white/55 leading-relaxed">
                            ยังไม่มีคดี — <Link href="/lawyer-dashboard/cases" className="text-blue-300 hover:underline">เปิดแฟ้มคดี</Link> แล้ว AI จะใช้ข้อมูลในแฟ้มประกอบคำตอบได้
                        </p>
                    ) : (
                        <div className="space-y-0.5">
                            {cases.map(c => {
                                const active = c.id === caseId;
                                const list = byCase(c.id);
                                return (
                                    <div key={c.id}>
                                        <button
                                            type="button"
                                            onClick={() => (active && !threadId ? undefined : onNew(c.id))}
                                            className={cn(
                                                'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px]',
                                                active ? 'bg-white/15 font-semibold text-white' : 'text-white/85 hover:text-white hover:bg-white/[0.07]',
                                            )}
                                        >
                                            <FolderOpen className={cn('w-4 h-4 shrink-0', active ? 'text-amber-300' : 'text-white/60')} />
                                            <span className="truncate flex-1">{c.title}</span>
                                            {list.length > 0 && <span className="text-[10px] text-white/50">{list.length}</span>}
                                        </button>
                                        {active && list.length > 0 && (
                                            <div className="ml-4 pl-2 border-l border-white/15 mt-0.5 space-y-0.5">
                                                {list.map(t => <ThreadRow key={t.id} t={t} />)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>}

                {general.length > 0 && (
                    <div>
                        <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">{copy.historyLabel}</p>
                        <div className="space-y-0.5">{general.map(t => <ThreadRow key={t.id} t={t} />)}</div>
                    </div>
                )}
            </div>
            <div className="p-3 border-t border-white/10">
                <Link
                    href={copy.home}
                    className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white/80 hover:text-white hover:bg-white/[0.07]"
                >
                    <ArrowLeft className="w-4 h-4" />{copy.homeLabel}
                </Link>
            </div>
        </div>
    );
}
