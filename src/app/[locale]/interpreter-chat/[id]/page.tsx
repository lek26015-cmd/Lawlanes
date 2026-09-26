'use client';

/**
 * แชทลูกค้า ↔ ล่าม (ใช้ได้ตั้งแต่ก่อนจอง)
 * ก่อนจ่ายเงิน: ข้อมูลติดต่อในข้อความถูกปิดฝั่ง server และไม่แสดงเบอร์/LINE ของอีกฝ่าย
 * หลังจ่ายเงิน: แสดงข้อมูลติดต่อของอีกฝ่ายด้านบนห้อง
 * ดึงข้อความใหม่ด้วยการ poll server action (ไม่พึ่ง Firebase Auth ฝั่ง browser)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileSignature, Loader2, Lock, Phone, Send, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
    cancelInterpreterOfferAction,
    createInterpreterOfferAction,
    getInterpreterConversationAction,
    sendInterpreterMessageAction,
} from '@/app/actions/interpreter-chat-actions';
import { getPublicInterpreterAction } from '@/app/actions/interpreter-directory-actions';
import { useInterpreterLabels } from '@/components/interpreter/use-interpreter-labels';
import { bangkokParts } from '@/lib/interpreter-time';
import {
    BOOKING_LIMITS,
    CHAT_LIMITS,
    type InterpreterChatMessage,
    type InterpreterConversationDetail,
    type InterpreterLanguageCode,
    type InterpreterOffer,
    type InterpreterService,
    type PublicInterpreter,
} from '@/lib/interpreter-types';

const POLL_MS = 5000;

function OfferCard({ offer, viewerRole, interpreterId, conversationId, onChanged }: {
    offer: InterpreterOffer;
    viewerRole: 'customer' | 'interpreter';
    interpreterId: string;
    conversationId: string;
    onChanged: () => void;
}) {
    const t = useTranslations('InterpreterChat');
    const tBook = useTranslations('Interpreters.book');
    const l = useInterpreterLabels();
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);

    const cancel = async () => {
        if (!window.confirm(t('cancelOfferConfirm'))) return;
        setBusy(true);
        const res = await cancelInterpreterOfferAction(conversationId, offer.id);
        setBusy(false);
        if (!res.ok) return toast({ variant: 'destructive', title: res.error });
        onChanged();
    };

    return (
        <div className="rounded-2xl border bg-white p-4 space-y-2 text-slate-900 w-full max-w-sm">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-blue-800 flex items-center gap-1"><FileSignature className="w-3.5 h-3.5" /> {t('offer')}</p>
                <Badge variant={offer.status === 'open' ? 'default' : 'secondary'}>{t(`offerStatus.${offer.status}`)}</Badge>
            </div>
            <p className="font-bold">{offer.title}</p>
            {offer.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{offer.description}</p>}
            <p className="text-xs text-muted-foreground">
                {l.service(offer.service)} · {l.language(offer.languageFrom)} → {l.language(offer.languageTo)}
                {offer.date && ` · ${offer.date} ${String(offer.startHour).padStart(2, '0')}:00 (${tBook('hoursUnit', { hours: offer.hours ?? 0 })})`}
            </p>
            <p className="text-xl font-bold text-[#0B3979]">฿{l.money(offer.amount)}</p>
            {offer.status === 'open' && offer.expiresAt && (
                <p className="text-xs text-muted-foreground">{t('offerExpires', { date: l.dateTime(offer.expiresAt) })}</p>
            )}
            {offer.status === 'open' && viewerRole === 'customer' && (
                <Button asChild className="w-full bg-[#0B3979]">
                    <Link href={`/interpreters/${interpreterId}/book?offer=${offer.id}`}>{t('payOffer')}</Link>
                </Button>
            )}
            {offer.status === 'open' && viewerRole === 'interpreter' && (
                <Button variant="outline" size="sm" disabled={busy} onClick={cancel}>{t('cancelOffer')}</Button>
            )}
        </div>
    );
}

function OfferComposer({ interpreter, conversationId, onSent, onClose }: {
    interpreter: PublicInterpreter;
    conversationId: string;
    onSent: () => void;
    onClose: () => void;
}) {
    const t = useTranslations('InterpreterChat');
    const tBook = useTranslations('Interpreters.book');
    const l = useInterpreterLabels();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [service, setService] = useState<InterpreterService>(interpreter.services[0]);
    const [from, setFrom] = useState<InterpreterLanguageCode>(interpreter.languageCodes.find(c => c !== 'th') || interpreter.languageCodes[0]);
    const [to, setTo] = useState<InterpreterLanguageCode>(interpreter.languageCodes.includes('th') ? 'th' : interpreter.languageCodes[1]);
    const [date, setDate] = useState('');
    const [startHour, setStartHour] = useState('9');
    const [hours, setHours] = useState('4');
    const [sending, setSending] = useState(false);
    const minDate = bangkokParts(new Date(Date.now() + 24 * 60 * 60 * 1000)).dateKey;

    const send = async () => {
        setSending(true);
        const res = await createInterpreterOfferAction(conversationId, {
            title, description, amount: Number(amount), service, languageFrom: from, languageTo: to,
            ...(date ? { date, startHour: Number(startHour), hours: Number(hours) } : {}),
        });
        setSending(false);
        if (!res.ok) return toast({ variant: 'destructive', title: res.error });
        onSent();
        onClose();
    };

    return (
        <Card className="rounded-2xl border-blue-200">
            <CardContent className="p-4 space-y-3">
                <p className="font-semibold">{t('newOffer')}</p>
                <div className="grid sm:grid-cols-[1fr_10rem] gap-3">
                    <div className="space-y-1">
                        <Label className="text-xs">{t('offerTitle')}</Label>
                        <Input value={title} maxLength={100} placeholder={t('offerTitlePlaceholder')} onChange={e => setTitle(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">{t('offerAmount')}</Label>
                        <Input type="number" min={100} value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>
                </div>
                <Textarea rows={3} maxLength={1000} value={description} placeholder={t('offerDescriptionPlaceholder')} onChange={e => setDescription(e.target.value)} />
                <div className="grid sm:grid-cols-3 gap-3">
                    <Select value={service} onValueChange={v => setService(v as InterpreterService)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{interpreter.services.map(s => <SelectItem key={s} value={s}>{l.service(s)}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={from} onValueChange={v => setFrom(v as InterpreterLanguageCode)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{interpreter.languageCodes.map(c => <SelectItem key={c} value={c}>{l.language(c)}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={to} onValueChange={v => setTo(v as InterpreterLanguageCode)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{interpreter.languageCodes.filter(c => c !== from).map(c => <SelectItem key={c} value={c}>{l.language(c)}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                        <Label className="text-xs">{t('offerDate')}</Label>
                        <Input type="date" min={minDate} value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    {date && (
                        <>
                            <div className="space-y-1">
                                <Label className="text-xs">{tBook('startTime')}</Label>
                                <Select value={startHour} onValueChange={setStartHour}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{Array.from({ length: 24 }, (_, h) => <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">{tBook('duration')}</Label>
                                <Select value={hours} onValueChange={setHours}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{Array.from({ length: BOOKING_LIMITS.maxHours }, (_, i) => i + 1).map(h => <SelectItem key={h} value={String(h)}>{tBook('hoursUnit', { hours: h })}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">{t('offerDateHint')}</p>
                <div className="flex gap-2 justify-end">
                    <Button variant="ghost" onClick={onClose}>{tBook('back')}</Button>
                    <Button className="bg-[#0B3979]" disabled={sending || !title.trim() || !(Number(amount) >= 100)} onClick={send}>
                        {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('sendOffer')}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default function InterpreterChatPage() {
    const { id } = useParams<{ id: string }>();
    const t = useTranslations('InterpreterChat');
    const l = useInterpreterLabels();
    const { toast } = useToast();
    const [conv, setConv] = useState<InterpreterConversationDetail | null>(null);
    const [error, setError] = useState('');
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [composing, setComposing] = useState(false);
    const [interpreter, setInterpreter] = useState<PublicInterpreter | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const lastCount = useRef(0);

    const load = useCallback(async () => {
        const res = await getInterpreterConversationAction(id);
        if (!res.ok) return setError(res.error);
        setConv(res.conversation);
    }, [id]);

    useEffect(() => {
        load();
        const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
        return () => clearInterval(timer);
    }, [load]);

    useEffect(() => {
        if (conv?.viewerRole === 'interpreter' && !interpreter) getPublicInterpreterAction(conv.interpreterId).then(setInterpreter);
    }, [conv?.viewerRole, conv?.interpreterId, interpreter]);

    useEffect(() => {
        if (conv && conv.messages.length !== lastCount.current) {
            lastCount.current = conv.messages.length;
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [conv]);

    const send = async () => {
        if (!text.trim()) return;
        setSending(true);
        const res = await sendInterpreterMessageAction(id, text);
        setSending(false);
        if (!res.ok) return toast({ variant: 'destructive', title: res.error });
        if (res.masked) toast({ title: t('maskedToast') });
        setText('');
        load();
    };

    if (error) {
        return <div className="container mx-auto px-4 py-24 max-w-md text-center text-muted-foreground">{error}</div>;
    }
    if (!conv) {
        return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-[#0B3979]" /></div>;
    }

    const isInterpreter = conv.viewerRole === 'interpreter';
    const backHref = isInterpreter ? '/interpreter-dashboard' : `/interpreters/${conv.interpreterId}`;

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="container mx-auto px-4 md:px-6 py-6 max-w-3xl flex flex-col min-h-[calc(100vh-5rem)]">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> {conv.otherName || t('customer')}
                    </Link>
                    {!isInterpreter && (
                        <Button asChild size="sm" className="bg-[#0B3979]">
                            <Link href={`/interpreters/${conv.interpreterId}/book`}>{t('bookFromRateCard')}</Link>
                        </Button>
                    )}
                </div>

                {conv.unlocked && conv.contact ? (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm mb-4 space-y-1">
                        <p className="font-semibold text-emerald-900 flex items-center gap-2"><Phone className="w-4 h-4" /> {t('contactUnlocked')}</p>
                        <p>{conv.contact.name}</p>
                        <p>{t('phone')}: <a className="font-medium underline" href={`tel:${conv.contact.phone}`}>{conv.contact.phone || '—'}</a></p>
                        <p>LINE ID: <span className="font-medium">{conv.contact.lineId || '—'}</span></p>
                    </div>
                ) : (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 mb-4 flex items-start gap-2">
                        <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" /> {t('contactLocked')}
                    </div>
                )}

                <div className="flex-1 space-y-3 overflow-y-auto pb-4">
                    {conv.messages.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-10">{isInterpreter ? t('emptyInterpreter') : t('emptyCustomer')}</p>
                    )}
                    {conv.messages.map((m: InterpreterChatMessage) => (
                        <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-[80%] space-y-1">
                                {m.offer ? (
                                    <OfferCard offer={m.offer} viewerRole={conv.viewerRole} interpreterId={conv.interpreterId} conversationId={conv.id} onChanged={load} />
                                ) : (
                                    <div className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-line break-words ${m.mine ? 'bg-[#0B3979] text-white' : 'bg-white shadow-sm'}`}>
                                        {m.text}
                                    </div>
                                )}
                                <p className={`text-[11px] text-muted-foreground flex items-center gap-1 ${m.mine ? 'justify-end' : ''}`}>
                                    {m.masked && <><ShieldAlert className="w-3 h-3" /> {t('maskedLabel')} · </>}
                                    {m.createdAt ? l.dateTime(m.createdAt) : ''}
                                </p>
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                <div className="sticky bottom-0 bg-gray-50 pt-2 pb-4 space-y-3">
                    {composing && interpreter && (
                        <OfferComposer interpreter={interpreter} conversationId={conv.id} onSent={load} onClose={() => setComposing(false)} />
                    )}
                    <div className="flex gap-2 items-end">
                        <Textarea
                            rows={2}
                            value={text}
                            maxLength={CHAT_LIMITS.maxLength}
                            placeholder={t('placeholder')}
                            className="bg-white"
                            onChange={e => setText(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
                            }}
                        />
                        <Button className="bg-[#0B3979] h-12 w-12 flex-shrink-0" size="icon" disabled={sending || !text.trim()} onClick={send} aria-label={t('send')}>
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                    </div>
                    {isInterpreter && !composing && (
                        <Button variant="outline" size="sm" disabled={!interpreter} onClick={() => setComposing(true)}>
                            <FileSignature className="w-4 h-4 mr-2" /> {t('newOffer')}
                        </Button>
                    )}
                    <p className="text-[11px] text-muted-foreground">{t('platformNote')}</p>
                </div>
            </div>
        </div>
    );
}
