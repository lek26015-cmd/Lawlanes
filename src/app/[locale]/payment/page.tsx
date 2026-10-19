'use client'

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Link } from '@/navigation';
import { ArrowLeft, CheckCircle, Loader2, Landmark, Copy, AlertCircle, MessageSquare, Clock, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { saveBase64SlipAction } from '@/app/actions/upload';
import { getLawyerPaymentInfoAction, payLawyerFeeAction, type LawyerPaymentInfo } from '@/app/actions/lawyer-payment-actions';
import type { LawyerPaymentType } from '@/lib/lawyer-payment-core';
import { SlipUpload, type SlipState } from '@/components/interpreter/slip-upload';
import { compressImageToBase64 } from '@/lib/image-utils';
import { cn } from '@/lib/utils';

/**
 * หน้าชำระค่าทนาย — ลูกความโอนเข้าบัญชี Lawslane แล้วแนบสลิป (LAWSLANE-PLAN-10)
 *
 * Lawslane รับเงินไว้ หัก GP ทนาย แล้วโอนยอดสุทธิให้ทนายหลังปิดเคส (ลูกความเห็นแค่ยอดเต็มที่ต้องจ่าย)
 * SlipOK ตรวจผ่าน = จ่ายแล้วทันที · ตรวจไม่ได้ = รอทีมงานตรวจสลิป
 *
 * คง path /payment ไว้เพราะลิงก์ในอีเมล/แจ้งเตือน/ข้อความแชทที่ส่งไปแล้วชี้มาที่นี่
 * (`?chatId=...&type=case|installment|additional|consultation`) ยอดทั้งหมดอ่านจาก server
 */

function normalizeType(t: string | null): LawyerPaymentType | undefined {
    if (t === 'case' || t === 'installment' || t === 'additional') return t;
    // ลิงก์รุ่นเก่าจาก requestFeeAction ใช้ type=consultation กับคำขอค่าบริการ (pendingFeeRequest)
    if (t === 'consultation') return 'additional';
    return undefined;
}

function PaymentPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const { user, isUserLoading } = useFirebase();

    const chatId = searchParams.get('chatId');
    const wantType = normalizeType(searchParams.get('type'));
    const idxParam = searchParams.get('installmentIndex');
    const wantIndex = idxParam !== null && /^\d+$/.test(idxParam) ? parseInt(idxParam, 10) : undefined;

    const [info, setInfo] = useState<LawyerPaymentInfo | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [done, setDone] = useState<'paid' | 'pending_review' | null>(null);
    const [slip, setSlip] = useState<SlipState>({ file: null, verificationId: null, status: 'none' });

    useEffect(() => {
        if (!chatId) { setIsLoading(false); return; }
        if (isUserLoading) return;
        if (!user) { setIsLoading(false); setLoadError('กรุณาเข้าสู่ระบบก่อน'); return; }
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            const res = await getLawyerPaymentInfoAction(chatId, { type: wantType, installmentIndex: wantIndex });
            if (cancelled) return;
            if (res.ok) setInfo(res.data); else setLoadError(res.error);
            setIsLoading(false);
        })();
        return () => { cancelled = true; };
    }, [chatId, wantType, wantIndex, user, isUserLoading]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'คัดลอกแล้ว', description: text });
    };

    const handlePay = async () => {
        if (!info?.due || !chatId || !slip.file) return;
        setIsSubmitting(true);
        try {
            let slipUrl: string;
            try {
                slipUrl = await saveBase64SlipAction(await compressImageToBase64(slip.file));
            } catch {
                toast({ variant: 'destructive', title: 'อัปโหลดสลิปไม่สำเร็จ', description: 'ลองใหม่อีกครั้ง หรือใช้รูปที่เล็กลง' });
                return;
            }
            const res = await payLawyerFeeAction({
                chatId,
                type: info.due.type,
                installmentIndex: info.due.installmentIndex,
                slipUrl,
                slipVerificationId: slip.verificationId,
            });
            if (!res.ok) {
                toast({ variant: 'destructive', title: 'ชำระเงินไม่สำเร็จ', description: res.error });
                return;
            }
            setDone(res.status);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="animate-spin text-blue-600" /></div>;

    // ลิงก์รุ่นเก่า (Ticket ฿500 / นัดหมาย ฿3,500) ที่ไม่มีห้องแชท — ไม่มีอะไรต้องจ่ายแล้ว
    if (!chatId) {
        return (
            <Card className="w-full max-w-xl mx-auto border-none shadow-xl rounded-3xl mt-10">
                <CardContent className="pt-10 pb-10 text-center space-y-5">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                        <MessageSquare className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">ปรึกษาทนายผ่าน Lawslane ฟรี</h2>
                    <p className="text-slate-500 max-w-md mx-auto">
                        แชทและขอนัดหมายกับทนายไม่มีค่าใช้จ่าย หากทนายเสนอค่าบริการ
                        คุณจะชำระเข้าบัญชี Lawslane ผ่านปุ่มชำระเงินในห้องแชท
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button asChild variant="outline" className="rounded-xl"><Link href="/lawyers">ค้นหาทนาย</Link></Button>
                        <Button asChild className="rounded-xl bg-[#0B3979] hover:bg-[#082a5a]"><Link href="/dashboard">ไปที่แดชบอร์ด</Link></Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (loadError || !info) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <h2 className="text-xl font-bold">{loadError || 'ไม่พบรายการ'}</h2>
                <Button asChild variant="outline"><Link href="/dashboard">กลับไปที่แดชบอร์ด</Link></Button>
            </div>
        );
    }

    const chatLink = `/chat/${chatId}${info.role === 'lawyer' ? '?view=lawyer' : ''}`;

    if (done) {
        const paid = done === 'paid';
        return (
            <Card className="w-full max-w-2xl mx-auto border-none shadow-2xl rounded-3xl overflow-hidden mt-10">
                <div className={cn('h-2', paid ? 'bg-green-500' : 'bg-[#0B3979]')} />
                <CardContent className="pt-12 pb-12 text-center space-y-6">
                    <div className={cn('w-20 h-20 rounded-full flex items-center justify-center mx-auto', paid ? 'bg-green-100' : 'bg-blue-50')}>
                        {paid ? <CheckCircle className="w-10 h-10 text-green-600" /> : <Clock className="w-10 h-10 text-[#0B3979]" />}
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800 mb-2">{paid ? 'ชำระเงินเรียบร้อย' : 'ได้รับสลิปแล้ว'}</h2>
                        <p className="text-slate-500 max-w-md mx-auto">
                            {paid
                                ? 'ระบบตรวจสลิปผ่านแล้ว ทนายได้รับแจ้งว่าคุณชำระเรียบร้อย'
                                : 'ทีมงาน Lawslane กำลังตรวจสลิป และจะแจ้งผลในห้องแชท'}
                        </p>
                    </div>
                    <Button asChild className="rounded-xl px-8 h-12 bg-[#0B3979] hover:bg-[#082a5a]">
                        <Link href={chatLink}>กลับไปยังห้องแชท</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const due = info.due;
    const isClient = info.role === 'client';
    const account = info.account;

    return (
        <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-12 mb-2">
                <Button variant="ghost" onClick={() => router.back()} className="text-slate-500 hover:bg-white/50 rounded-xl">
                    <ArrowLeft className="mr-2 h-4 w-4" /> ย้อนกลับ
                </Button>
            </div>

            <div className="lg:col-span-7 space-y-6">
                <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                    <CardHeader className="bg-[#0B3979] text-white p-8">
                        <div className="flex justify-between items-start mb-2">
                            <CardTitle className="text-2xl font-headline tracking-tight">ชำระค่าบริการทนายความ</CardTitle>
                            <Landmark className="w-8 h-8 opacity-20" />
                        </div>
                        <CardDescription className="text-blue-100 text-base opacity-90">
                            {due ? due.description : 'ไม่มียอดค้างชำระสำหรับเคสนี้'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
                            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">โอนเข้าบัญชีของ Lawslane เท่านั้น</p>
                                <p className="text-sm mt-1">Lawslane รับเงินไว้ก่อน และโอนค่าบริการให้ทนายหลังทนายปิดเคส ห้ามโอนเข้าบัญชีส่วนตัวของทนาย</p>
                            </div>
                        </div>

                        {!due ? (
                            <div className="text-center py-6 space-y-4">
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                                <p className="text-slate-600">ชำระครบทุกรายการแล้ว หรือทนายยังไม่ได้เสนอค่าบริการ</p>
                                <Button asChild variant="outline" className="rounded-xl"><Link href={chatLink}>กลับไปยังห้องแชท</Link></Button>
                            </div>
                        ) : due.pendingReview ? (
                            <div className="flex gap-3 bg-blue-50 rounded-2xl p-4 border border-blue-200 text-blue-900 text-sm">
                                <Clock className="w-5 h-5 shrink-0 mt-0.5" />
                                <p>แนบสลิปรายการนี้แล้ว ทีมงาน Lawslane กำลังตรวจ และจะแจ้งผลในห้องแชท</p>
                            </div>
                        ) : !account ? (
                            <div className="flex gap-3 bg-amber-50 rounded-2xl p-4 border border-amber-200 text-amber-900 text-sm">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <p>ระบบชำระเงินยังไม่พร้อม กรุณาติดต่อทีมงาน Lawslane</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <h3 className="font-bold text-lg flex items-center gap-3 text-slate-800">
                                        <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm font-black">1</span>
                                        โอนเข้าบัญชี Lawslane
                                    </h3>
                                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200/60 space-y-4">
                                        <p className="font-bold text-slate-700">{account.bankName}</p>
                                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/50">
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">เลขที่บัญชี</p>
                                                <p className="text-2xl font-black text-[#0B3979] tracking-tight">{account.accountNumber}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(account.accountNumber)} className="h-12 w-12 rounded-xl text-blue-600 hover:bg-blue-50" aria-label="คัดลอกเลขบัญชี">
                                                <Copy className="w-5 h-5" />
                                            </Button>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">ชื่อบัญชี</p>
                                            <p className="font-bold text-slate-700 text-lg">{account.accountName}</p>
                                        </div>
                                    </div>
                                </div>

                                {isClient && (
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-lg flex items-center gap-3 text-slate-800">
                                            <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm font-black">2</span>
                                            แนบสลิปการโอน
                                        </h3>
                                        <SlipUpload expectedBaht={due.amount} value={slip} onChange={setSlip} />
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                    {due && !due.pendingReview && account && (
                        <CardFooter className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                            {isClient ? (
                                <Button
                                    onClick={handlePay}
                                    className="w-full h-14 rounded-[1.5rem] text-lg font-black bg-[#0B3979] hover:bg-[#082a5a]"
                                    disabled={isSubmitting || !slip.file || slip.status === 'checking' || slip.status === 'mismatch'}
                                >
                                    {isSubmitting ? <><Loader2 className="mr-3 animate-spin w-5 h-5" />กำลังส่ง...</> : 'ยืนยันการชำระเงิน'}
                                </Button>
                            ) : (
                                <Button asChild className="w-full h-12 rounded-2xl bg-[#0B3979] hover:bg-[#082a5a]">
                                    <Link href={chatLink}>กลับไปยังห้องแชท</Link>
                                </Button>
                            )}
                            <p className="text-xs text-slate-400 text-center">ระบบตรวจสลิปอัตโนมัติ ถ้าตรวจไม่ได้ ทีมงาน Lawslane จะตรวจให้</p>
                        </CardFooter>
                    )}
                </Card>
            </div>

            <div className="lg:col-span-5 space-y-6">
                <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
                    <CardHeader className="border-b p-6">
                        <CardTitle className="text-lg font-bold text-slate-800">สรุปรายการ</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-14 w-14">
                                <AvatarImage src={info.lawyer.imageUrl} />
                                <AvatarFallback className="bg-[#0B3979] text-white font-bold">{info.lawyer.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">ทนายความ</p>
                                <p className="font-extrabold text-lg text-slate-900 leading-tight">{info.lawyer.name}</p>
                                {info.caseTitle && <p className="text-xs text-slate-500">{info.caseTitle}</p>}
                            </div>
                        </div>
                        {due && (
                            <div className="flex justify-between items-baseline pt-4 border-t border-slate-100">
                                <span className="font-bold text-slate-400">ยอดที่ต้องโอน</span>
                                <span className="text-3xl font-black tracking-tight text-slate-900">฿{due.amount.toLocaleString()}</span>
                            </div>
                        )}
                        {info.outstanding.length > 1 && (
                            <div className="pt-4 border-t border-slate-100 space-y-2">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">รายการที่ยังไม่ได้ชำระ</p>
                                {info.outstanding.map((d) => (
                                    <Link
                                        key={`${d.type}-${d.installmentIndex ?? ''}`}
                                        href={`/payment?chatId=${chatId}&type=${d.type}${d.installmentIndex !== undefined ? `&installmentIndex=${d.installmentIndex}` : ''}`}
                                        className={cn(
                                            "flex justify-between text-sm p-2 rounded-lg hover:bg-slate-50",
                                            due && d.type === due.type && d.installmentIndex === due.installmentIndex && "bg-blue-50"
                                        )}
                                    >
                                        <span className="truncate mr-2">{d.description}{d.pendingReview ? ' (รอตรวจสลิป)' : ''}</span>
                                        <span className="font-bold whitespace-nowrap">฿{d.amount.toLocaleString()}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function PaymentPage() {
    return (
        <div className="bg-[#F8FAFC] min-h-screen py-12 md:py-20 font-sans">
            <div className="container mx-auto px-4 md:px-6">
                <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="animate-spin w-10 h-10 text-blue-600" /></div>}>
                    <PaymentPageContent />
                </Suspense>
            </div>
        </div>
    )
}
