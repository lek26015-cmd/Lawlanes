'use client'

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Link } from '@/navigation';
import { ArrowLeft, CheckCircle, Loader2, Landmark, Upload, Copy, AlertCircle, MessageSquare, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { saveBase64SlipAction } from '@/app/actions/upload';
import {
    getDirectPaymentInfoAction,
    notifyDirectPaymentAction,
    type DirectPaymentInfo,
    type DirectPaymentType,
} from '@/app/actions/direct-payment-actions';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/constants';
import { compressImageToBase64 } from '@/lib/image-utils';
import { cn } from '@/lib/utils';

/**
 * หน้า "โอนให้ทนายโดยตรง"
 *
 * เดิมหน้านี้คือหน้าชำระเงินเข้าบัญชีของแพลตฟอร์ม (บัญชี KBank บุคคลที่ hardcode ไว้) สำหรับ
 * Ticket ฿500 / นัดหมาย ฿3,500 / ค่าเปิดคดี / งวด / ค่าบริการเพิ่มเติม พร้อมตรวจสลิป SlipOK และคูปอง
 * ตอนนี้ Lawslane ไม่รับและไม่ถือเงินลูกความแล้ว (LAWSLANE-PLAN-05):
 *   - แชทฟรี นัดหมายฟรี → ไม่มีอะไรต้องจ่ายผ่านหน้านี้
 *   - ค่าบริการที่ทนายเสนอ → แสดงบัญชีของทนายเจ้าของเคส ลูกความโอนเอง แล้วกดแจ้งทนาย
 *     (แนบรูปหลักฐานได้) ทนายเป็นคนกดยืนยันรับเงินในห้องแชท
 *
 * คง path /payment ไว้เพราะลิงก์ในอีเมล/แจ้งเตือน/ข้อความแชทที่ส่งไปแล้วชี้มาที่นี่
 * (`?chatId=...&type=case|installment|additional|consultation`) ยอดทั้งหมดอ่านจาก server
 * ไม่ใช้ `?amount=` ใน URL
 */

function normalizeType(t: string | null): DirectPaymentType | undefined {
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

    const [info, setInfo] = useState<DirectPaymentInfo | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!chatId) { setIsLoading(false); return; }
        if (isUserLoading) return;
        if (!user) { setIsLoading(false); setLoadError('กรุณาเข้าสู่ระบบก่อน'); return; }
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            const res = await getDirectPaymentInfoAction(chatId, { type: wantType, installmentIndex: wantIndex });
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

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast({ variant: 'destructive', title: 'ไฟล์ใหญ่เกินไป', description: `ไม่เกิน ${MAX_FILE_SIZE_MB}MB` });
            return;
        }
        setProofFile(file);
        setProofPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    };

    const uploadProof = async (file: File) => {
        let base64Data: string;
        if (file.type.startsWith('image/')) {
            base64Data = await compressImageToBase64(file);
        } else {
            base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
            });
        }
        return await saveBase64SlipAction(base64Data);
    };

    const handleNotify = async () => {
        if (!info?.due || !chatId) return;
        setIsSubmitting(true);
        try {
            let proofUrl: string | null = null;
            if (proofFile) {
                try {
                    proofUrl = await uploadProof(proofFile);
                } catch {
                    toast({ variant: 'destructive', title: 'อัปโหลดหลักฐานไม่สำเร็จ', description: 'ไฟล์อาจใหญ่เกินไป ลองใหม่ หรือแจ้งโดยไม่แนบรูปก็ได้' });
                    return;
                }
            }
            const res = await notifyDirectPaymentAction({
                chatId,
                type: info.due.type,
                installmentIndex: info.due.installmentIndex,
                proofUrl,
                note: note || null,
            });
            if (!res.ok) {
                toast({ variant: 'destructive', title: 'แจ้งโอนไม่สำเร็จ', description: res.error });
                return;
            }
            setDone(true);
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
                        แชทและขอนัดหมายกับทนายไม่มีค่าใช้จ่ายผ่านระบบ หากทนายเสนอค่าบริการ
                        คุณจะโอนให้ทนายโดยตรงตามข้อมูลบัญชีในห้องแชท
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
        return (
            <Card className="w-full max-w-2xl mx-auto border-none shadow-2xl rounded-3xl overflow-hidden mt-10">
                <div className="h-2 bg-green-500" />
                <CardContent className="pt-12 pb-12 text-center space-y-6">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800 mb-2">แจ้งทนายเรียบร้อยแล้ว</h2>
                        <p className="text-slate-500 max-w-md mx-auto">
                            ทนายจะตรวจสอบยอดในบัญชีของตัวเองแล้วกดยืนยันรับเงินในห้องแชท
                            หากมีข้อสงสัยเรื่องการโอน กรุณาคุยกับทนายในแชทโดยตรง
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
                            <CardTitle className="text-2xl font-headline tracking-tight">โอนค่าบริการให้ทนายโดยตรง</CardTitle>
                            <Landmark className="w-8 h-8 opacity-20" />
                        </div>
                        <CardDescription className="text-blue-100 text-base opacity-90">
                            {due ? due.description : 'ไม่มียอดค้างชำระสำหรับเคสนี้'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-900">
                            <p className="font-black">Lawslane ไม่ได้รับและไม่ได้ถือเงินก้อนนี้ กรุณาโอนให้ทนายโดยตรง</p>
                            <p className="text-sm mt-1">ตรวจสอบชื่อบัญชีให้ตรงกับทนายของคุณก่อนโอนทุกครั้ง</p>
                        </div>

                        {!due ? (
                            <div className="text-center py-6 space-y-4">
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                                <p className="text-slate-600">ทนายยืนยันรับเงินครบทุกรายการแล้ว หรือยังไม่ได้เสนอค่าบริการ</p>
                                <Button asChild variant="outline" className="rounded-xl"><Link href={chatLink}>กลับไปยังห้องแชท</Link></Button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <h3 className="font-bold text-lg flex items-center gap-3 text-slate-800">
                                        <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm font-black">1</span>
                                        โอนเข้าบัญชีของทนาย
                                    </h3>
                                    {info.hasBankAccount ? (
                                        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200/60 space-y-4">
                                            <p className="font-bold text-slate-700">{info.lawyer.bankName}</p>
                                            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/50">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">เลขที่บัญชี</p>
                                                    <p className="text-2xl font-black text-[#0B3979] tracking-tight">{info.lawyer.bankAccountNumber}</p>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(info.lawyer.bankAccountNumber)} className="h-12 w-12 rounded-xl text-blue-600 hover:bg-blue-50" aria-label="คัดลอกเลขบัญชี">
                                                    <Copy className="w-5 h-5" />
                                                </Button>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">ชื่อบัญชี</p>
                                                <p className="font-bold text-slate-700 text-lg">{info.lawyer.bankAccountName || info.lawyer.name}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-200 text-slate-700">
                                            <AlertCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                                            <p className="text-sm">ทนายยังไม่ได้กรอกข้อมูลบัญชีรับเงิน กรุณาสอบถามช่องทางการชำระเงินกับทนายในห้องแชท</p>
                                        </div>
                                    )}
                                </div>

                                {isClient && (
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-lg flex items-center gap-3 text-slate-800">
                                            <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm font-black">2</span>
                                            แจ้งทนายว่าโอนแล้ว (แนบหลักฐานได้ ไม่บังคับ)
                                        </h3>
                                        {due.notice && (
                                            <div className="flex gap-3 bg-blue-50 rounded-2xl p-4 border border-blue-200 text-blue-900 text-sm">
                                                <Clock className="w-5 h-5 shrink-0 mt-0.5" />
                                                <p>คุณแจ้งโอนรายการนี้ไว้แล้ว{due.notice.notifiedAt ? ` เมื่อ ${new Date(due.notice.notifiedAt).toLocaleString('th-TH')}` : ''} — รอทนายยืนยันรับเงิน แจ้งซ้ำได้หากต้องการแนบหลักฐานใหม่</p>
                                            </div>
                                        )}
                                        <div
                                            className={cn(
                                                "relative flex flex-col items-center justify-center w-full min-h-[160px] py-8 border-2 border-dashed rounded-[2rem] transition-all cursor-pointer",
                                                proofFile ? "border-green-200 bg-green-50/50" : "border-slate-200 bg-slate-50/30 hover:border-blue-400 hover:bg-blue-50/50"
                                            )}
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            {proofPreview ? (
                                                <img src={proofPreview} alt="หลักฐานการโอน" className="max-h-60 object-contain rounded-xl" />
                                            ) : proofFile ? (
                                                <p className="font-bold text-slate-700">{proofFile.name}</p>
                                            ) : (
                                                <div className="text-center space-y-2">
                                                    <Upload className="w-8 h-8 text-blue-500 mx-auto" />
                                                    <p className="font-bold text-slate-700">แนบรูปหลักฐานการโอน</p>
                                                    <p className="text-xs text-slate-400">ทนายจะเห็นรูปนี้ในห้องแชท</p>
                                                </div>
                                            )}
                                            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                                        </div>
                                        <Textarea
                                            placeholder="หมายเหตุถึงทนาย (ถ้ามี) เช่น โอนจากบัญชีชื่อ... เวลา..."
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            maxLength={500}
                                            className="rounded-2xl"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                    {due && (
                        <CardFooter className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                            {isClient ? (
                                <Button
                                    onClick={handleNotify}
                                    className="w-full h-14 rounded-[1.5rem] text-lg font-black bg-[#0B3979] hover:bg-[#082a5a]"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <><Loader2 className="mr-3 animate-spin w-5 h-5" />กำลังส่ง...</> : 'แจ้งทนายว่าโอนแล้ว'}
                                </Button>
                            ) : (
                                <Button asChild className="w-full h-12 rounded-2xl bg-[#0B3979] hover:bg-[#082a5a]">
                                    <Link href={chatLink}>ไปยืนยันรับเงินในห้องแชท</Link>
                                </Button>
                            )}
                            <p className="text-xs text-slate-400 text-center">การแจ้งโอนไม่ถือเป็นการยืนยันการชำระเงิน — ทนายเป็นผู้ยืนยันเมื่อได้รับเงินจริง</p>
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
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">รายการที่ยังไม่ได้ยืนยันรับเงิน</p>
                                {info.outstanding.map((d) => (
                                    <Link
                                        key={`${d.type}-${d.installmentIndex ?? ''}`}
                                        href={`/payment?chatId=${chatId}&type=${d.type}${d.installmentIndex !== undefined ? `&installmentIndex=${d.installmentIndex}` : ''}`}
                                        className={cn(
                                            "flex justify-between text-sm p-2 rounded-lg hover:bg-slate-50",
                                            due && d.type === due.type && d.installmentIndex === due.installmentIndex && "bg-blue-50"
                                        )}
                                    >
                                        <span className="truncate mr-2">{d.description}</span>
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
