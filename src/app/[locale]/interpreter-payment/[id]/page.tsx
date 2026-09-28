'use client';

import { use, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Copy, Loader2, AlertCircle, Clock } from 'lucide-react';
import { Link, usePathname } from '@/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { SlipUpload, type SlipState } from '@/components/interpreter/slip-upload';
import { useInterpreterLabels } from '@/components/interpreter/use-interpreter-labels';
import { compressImageToBase64 } from '@/lib/image-utils';
import { saveBase64SlipAction } from '@/app/actions/upload';
import { getPlatformPaymentAccountAction } from '@/app/actions/interpreter-booking-actions';
import {
    getInterpreterPaymentLinkAction,
    payInterpreterPaymentLinkAction,
    type PaymentLinkView,
} from '@/app/actions/interpreter-payment-link-actions';

type PaymentAccount = { bankName: string; accountNumber: string; accountName: string } | null;

/** หน้าชำระเงินจากลิงก์ที่แอดมินส่งในแชท — เห็นได้เฉพาะเจ้าของคำขอ */
export default function InterpreterPaymentPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const t = useTranslations('InterpreterPayment');
    const tb = useTranslations('Interpreters.book');
    const l = useInterpreterLabels();
    const { toast } = useToast();
    const pathname = usePathname();
    const { user, isUserLoading } = useUser();

    const [link, setLink] = useState<PaymentLinkView | null | undefined>(undefined);
    const [account, setAccount] = useState<PaymentAccount>(null);
    const [slip, setSlip] = useState<SlipState>({ file: null, verificationId: null, status: 'none' });
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState<'paid' | 'pending_review' | null>(null);

    useEffect(() => {
        if (!user) return;
        setContactName((n) => n || user.displayName || '');
        Promise.all([getInterpreterPaymentLinkAction(id), getPlatformPaymentAccountAction()])
            .then(([lk, acc]) => { setLink(lk); setAccount(acc); })
            .catch(() => setLink(null));
    }, [user, id]);

    const copy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: tb('copied'), description: text });
    };

    const handleConfirm = async () => {
        if (!slip.file || !link) return;
        setSubmitting(true);
        try {
            const slipUrl = await saveBase64SlipAction(await compressImageToBase64(slip.file));
            const res = await payInterpreterPaymentLinkAction(link.id, {
                slipUrl, slipVerificationId: slip.verificationId, contactName, contactPhone,
            });
            if (!res.ok) {
                toast({ variant: 'destructive', title: res.error });
                return;
            }
            setDone(res.status);
        } catch {
            toast({ variant: 'destructive', title: t('error') });
        } finally {
            setSubmitting(false);
        }
    };

    const shell = (children: React.ReactNode) => (
        <div className="bg-gray-50 min-h-screen">
            <div className="container mx-auto px-4 py-10 max-w-xl">{children}</div>
        </div>
    );
    const chatLink = link?.ticketId && (
        <Button asChild variant="outline" className="rounded-full">
            <Link href={`/support/${link.ticketId}`}>{t('backToChat')}</Link>
        </Button>
    );

    if (!user && isUserLoading) return shell(<div className="flex justify-center py-24"><Loader2 className="animate-spin text-[#0B3979]" /></div>);
    if (!user) {
        return shell(
            <div className="text-center space-y-4 py-16">
                <p className="font-semibold">{t('loginRequired')}</p>
                <Button asChild className="bg-[#0B3979]"><Link href={`/login?redirect=${encodeURIComponent(pathname)}`}>{t('login')}</Link></Button>
            </div>,
        );
    }
    if (link === undefined) return shell(<div className="flex justify-center py-24"><Loader2 className="animate-spin text-[#0B3979]" /></div>);
    if (link === null) return shell(<Message icon={<AlertCircle className="w-10 h-10 text-amber-500" />} title={t('notFound')} />);

    if (done) {
        return shell(
            <Message
                icon={done === 'paid' ? <CheckCircle2 className="w-12 h-12 text-emerald-500" /> : <Clock className="w-12 h-12 text-[#0B3979]" />}
                title={done === 'paid' ? t('paidTitle') : t('reviewTitle')}
                body={done === 'paid' ? t('paidBody') : t('reviewBody')}
                action={chatLink}
            />,
        );
    }
    if (link.status !== 'open') {
        return shell(<Message icon={<AlertCircle className="w-10 h-10 text-amber-500" />} title={link.status === 'expired' ? t('expired') : t('closed')} action={chatLink} />);
    }

    const rows: [string, string][] = [
        [t('item'), link.title],
        [t('interpreter'), link.interpreterName],
        [t('service'), link.service ? l.service(link.service) : ''],
        [t('languages'), link.languageFrom ? `${l.language(link.languageFrom)} → ${l.language(link.languageTo)}` : ''],
        [t('date'), link.date],
        [t('notes'), link.notes],
    ];

    return shell(
        <Card className="rounded-2xl border-none shadow-sm">
            <CardHeader>
                <CardTitle className="text-2xl text-[#0B3979]">{t('title')}</CardTitle>
                <CardDescription>{t('subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <dl className="space-y-2 text-sm">
                    {rows.filter(([, v]) => v).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4">
                            <dt className="text-muted-foreground shrink-0">{k}</dt>
                            <dd className="font-medium text-right whitespace-pre-line">{v}</dd>
                        </div>
                    ))}
                    <div className="flex justify-between gap-4 border-t pt-3 text-base">
                        <dt className="font-semibold">{t('amount')}</dt>
                        <dd className="font-bold text-[#0B3979]">฿{l.money(link.amountBaht)}</dd>
                    </div>
                </dl>

                {!account ? (
                    <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-4">{t('notReady')}</p>
                ) : (
                    <>
                        <div className="rounded-xl bg-slate-50 p-4 space-y-2 text-sm">
                            <p className="font-semibold text-slate-800">{t('transferTo')}</p>
                            <div className="flex justify-between"><span className="text-muted-foreground">{tb('bank')}</span><span className="font-semibold">{account.bankName}</span></div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">{tb('accountNumber')}</span>
                                <span className="font-semibold flex items-center gap-1">
                                    {account.accountNumber}
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(account.accountNumber)} aria-label={tb('copy')}>
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </span>
                            </div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{tb('accountName')}</span><span className="font-semibold">{account.accountName}</span></div>
                            <p className="text-xs text-muted-foreground pt-1">{t('payNote')}</p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="pay-name">{tb('contactName')}</Label>
                                <Input id="pay-name" value={contactName} maxLength={100} onChange={(e) => setContactName(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="pay-phone">{tb('contactPhone')}</Label>
                                <Input id="pay-phone" type="tel" value={contactPhone} maxLength={30} onChange={(e) => setContactPhone(e.target.value)} />
                            </div>
                        </div>

                        <SlipUpload expectedBaht={link.amountBaht} value={slip} onChange={setSlip} />

                        <Button
                            className="w-full h-12 rounded-full bg-[#0B3979] hover:bg-[#082a5a] text-base font-semibold"
                            disabled={!slip.file || slip.status === 'checking' || slip.status === 'mismatch' || !contactName || !contactPhone || submitting}
                            onClick={handleConfirm}
                        >
                            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('submitting')}</> : t('submit')}
                        </Button>
                    </>
                )}
                <div className="text-center">{chatLink}</div>
            </CardContent>
        </Card>,
    );
}

function Message({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center space-y-4">
            <div className="flex justify-center">{icon}</div>
            <h1 className="text-xl font-bold text-slate-800">{title}</h1>
            {body && <p className="text-slate-600">{body}</p>}
            {action}
        </div>
    );
}
