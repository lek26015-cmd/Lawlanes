
'use client'

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Link } from '@/navigation';
import { getLawyerById } from '@/lib/data';
import type { LawyerProfile } from '@/lib/types';
import { ArrowLeft, Calendar, User, CheckCircle, MessageSquare, Pencil, Loader2, Landmark, Upload, Copy, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@/context/chat-context';
import { Textarea } from '@/components/ui/textarea';
import { v4 as uuidv4 } from 'uuid';
import { useFirebase } from '@/firebase';
import { addDoc, collection, doc, serverTimestamp, setDoc, getDoc, query, where, getDocs, updateDoc, limit } from 'firebase/firestore';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { saveBase64SlipAction } from '@/app/actions/upload-secure';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/constants';
import { compressImageToBase64 } from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import jsQR from 'jsqr';
import { notifyPaymentCompletedAction, markInstallmentPaidAction, markCasePaidAction } from '@/app/actions/chat-actions';


function PaymentPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const { setInitialChatMessage } = useChat();
    const { firestore, user } = useFirebase();

    const paymentType = searchParams.get('type') || 'appointment';
    const lawyerId = searchParams.get('lawyerId');
    const chatId = searchParams.get('chatId');
    const amountParam = searchParams.get('amount');
    const dateStr = searchParams.get('date');
    const description = searchParams.get('description');
    const installmentIndexParam = searchParams.get('installmentIndex');
    const installmentIndex = installmentIndexParam !== null ? parseInt(installmentIndexParam) : null;

    const [lawyer, setLawyer] = useState<LawyerProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [initialMessage, setInitialMessage] = useState(description || '');
    const [slipFile, setSlipFile] = useState<File | null>(null);
    const [slipPreview, setSlipPreview] = useState<string | null>(null);
    const [isVerifyingSlip, setIsVerifyingSlip] = useState(false);
    const [slipOkData, setSlipOkData] = useState<any | null>(null);
    const [slipVerificationFailed, setSlipVerificationFailed] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Coupon State
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
    const [caseData, setCaseData] = useState<any | null>(null);


    const appointmentFee = 3500;
    const chatTicketFee = 500;
    let fee = paymentType === 'chat' ? chatTicketFee : appointmentFee;
    if ((paymentType === 'additional' || paymentType === 'case' || paymentType === 'installment') && amountParam) {
        fee = Number(amountParam);
    } else if (paymentType === 'case' && caseData) {
        fee = Number(caseData.amount || 0);
    }

    const finalFee = Math.max(0, fee - discountAmount);

    // Installment-specific metadata
    const installmentData = (paymentType === 'installment' && installmentIndex !== null && caseData?.installments?.[installmentIndex])
        ? caseData.installments[installmentIndex]
        : null;

    const title = paymentType === 'installment'
        ? `ชำระค่าบริการ — งวดที่ ${(installmentIndex ?? 0) + 1}`
        : paymentType === 'chat' ? 'ยืนยันการเปิด Ticket สนทนา' : (paymentType === 'additional' ? 'ชำระค่าบริการเพิ่มเติม' : (paymentType === 'case' ? 'ชำระค่าบริการเพื่อเริ่มงาน' : 'ยืนยันการนัดหมายและชำระเงิน'));
    const descriptionText = paymentType === 'installment'
        ? `ชำระเงินงวดที่ ${(installmentIndex ?? 0) + 1}: ${installmentData?.description || 'ตามแผนการชำระเงิน'}`
        : paymentType === 'chat' ? 'กรุณาตรวจสอบรายละเอียดและดำเนินการชำระเงินค่าเปิด Ticket' : (paymentType === 'additional' ? 'กรุณาชำระค่าบริการเพิ่มเติมตามที่ทนายความร้องขอ' : (paymentType === 'case' ? 'กรุณาชำระค่าบริการเพื่อเริ่มต้นคดีตามที่คุณได้รับแจ้ง' : 'กรุณาตรวจสอบรายละเอียดและดำเนินการชำระเงินค่าปรึกษา'));

    useEffect(() => {
        async function fetchLawyer() {
            if (!lawyerId || !firestore) {
                setIsLoading(false);
                return;
            }

            if (user) {
                const q = query(collection(firestore, "lawyerProfiles"), where("userId", "==", user.uid), limit(1));
                const lawyerSnap = await getDocs(q);
                if (!lawyerSnap.empty) {
                    toast({
                        variant: "destructive",
                        title: "ไม่สามารถทำรายการได้",
                        description: "บัญชีทนายความไม่สามารถชำระเงินค่าบริการได้"
                    });
                    router.push('/lawyer-dashboard');
                    return;
                }
            }

            setIsLoading(true);
            const lawyerData = await getLawyerById(firestore, lawyerId);
            setLawyer(lawyerData || null);

            if (chatId && (paymentType === 'case' || paymentType === 'installment')) {
                const chatSnap = await getDoc(doc(firestore, 'chats', chatId));
                if (chatSnap.exists()) {
                    setCaseData(chatSnap.data());
                }
            }
            setIsLoading(false);
        }
        fetchLawyer();
    }, [lawyerId, firestore, user, router, toast]);

    const uploadSlip = async (file: File) => {
        let base64Data = '';
        if (file.type.startsWith('image/')) {
            base64Data = await compressImageToBase64(file);
        } else {
            // For PDFs, just convert to Base64
            base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
            });
        }
        return await saveBase64SlipAction(base64Data);
    };

    const scanSlipQR = (file: File): Promise<string | null> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const image = new Image();
                image.crossOrigin = "anonymous";
                image.onload = () => {
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    if (!context) {
                        resolve(null);
                        return;
                    }
                    canvas.width = image.width;
                    canvas.height = image.height;
                    context.drawImage(image, 0, 0, image.width, image.height);
                    const imageData = context.getImageData(0, 0, image.width, image.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    resolve(code ? code.data : null);
                };
                image.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const verifySlipWithSlipOK = async (qrData: string) => {
        setIsVerifyingSlip(true);
        try {
            const response = await fetch('/api/verify-slip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: qrData }),
            });
            const result = await response.json();
            if (result.success) {
                setSlipOkData(result.data);
                setSlipVerificationFailed(false);
                
                const slipAmount = result.data.amount;
                if (Math.abs(slipAmount - finalFee) > 0.01) {
                    toast({
                        variant: "destructive",
                        title: "ยอดเงินไม่ตรง!",
                        description: `ยอดในสลิปคือ ฿${slipAmount.toLocaleString()} แต่ยอดที่ต้องชำระคือ ฿${finalFee.toLocaleString()}`
                    });
                } else {
                    toast({
                        title: "ตรวจสอบสลิปเบื้องต้นสำเร็จ",
                        description: "ยอดเงินถูกต้อง ระบบกำลังนำคุณไปขั้นตอนถัดไป"
                    });
                }
            } else {
                setSlipVerificationFailed(true);
                toast({
                    variant: "destructive",
                    title: "ตรวจสอบสลิปไม่สำเร็จ",
                    description: result.message || "ไม่สามารถยืนยันข้อมูลสลิปได้"
                });
            }
        } catch (error) {
            console.error("SlipOK error:", error);
        } finally {
            setIsVerifyingSlip(false);
        }
    };

    const handleApplyCoupon = async () => {
        if (!couponCode || !firestore) return;
        setIsCheckingCoupon(true);
        try {
            const q = query(
                collection(firestore, 'coupons'),
                where('code', '==', couponCode.toUpperCase()),
                where('isActive', '==', true),
                limit(1)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                toast({ variant: 'destructive', title: 'ไม่พบคูปอง', description: 'รหัสคูปองไม่ถูกต้องหรือหมดอายุ' });
                setAppliedCoupon(null);
                setDiscountAmount(0);
                setIsCheckingCoupon(false);
                return;
            }

            const couponData = snapshot.docs[0].data();
            const couponId = snapshot.docs[0].id;

            if (couponData.expiryDate && couponData.expiryDate.toDate() < new Date()) {
                toast({ variant: 'destructive', title: 'คูปองหมดอายุ', description: 'คูปองนี้หมดอายุแล้ว' });
                setAppliedCoupon(null);
                setDiscountAmount(0);
                setIsCheckingCoupon(false);
                return;
            }

            if (couponData.usageLimit && couponData.usedCount >= couponData.usageLimit) {
                toast({ variant: 'destructive', title: 'คูปองครบจำนวนสิทธิ์แล้ว', description: 'คูปองนี้ถูกใช้จนครบจำนวนสิทธิ์แล้ว' });
                setAppliedCoupon(null);
                setDiscountAmount(0);
                setIsCheckingCoupon(false);
                return;
            }

            let discount = 0;
            if (couponData.type === 'fixed') {
                discount = couponData.value;
            } else if (couponData.type === 'percent') {
                discount = (fee * couponData.value) / 100;
            }

            setDiscountAmount(discount);
            setAppliedCoupon({ id: couponId, ...couponData });
            toast({ title: 'ใช้คูปองสำเร็จ', description: `คุณได้รับส่วนลด ${new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(discount)}` });

        } catch (error) {
            console.error("Error checking coupon:", error);
            toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถตรวจสอบคูปองได้' });
        } finally {
            setIsCheckingCoupon(false);
        }
    };

    const handleRemoveCoupon = () => {
        setCouponCode('');
        setAppliedCoupon(null);
        setDiscountAmount(0);
    };

    const processPayment = async () => {
        const targetLawyerUserId = lawyer?.userId || lawyer?.id;
        setIsProcessing(true);
        if (!firestore || !user || !lawyer) {
            toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้" });
            setIsProcessing(false);
            return;
        }

        try {
            let slipUrl = '';
            if (slipFile) {
                try {
                    slipUrl = await uploadSlip(slipFile) as string;
                } catch (uploadError) {
                    console.warn("Upload failed:", uploadError);
                    toast({ variant: "destructive", title: "บันทึกสลิปไม่สำเร็จ", description: "ไฟล์อาจใหญ่เกินไป กรุณาลองใหม่อีกครั้ง" });
                    setIsProcessing(false);
                    return;
                }
            }

            // If SlipOK verified: mark as 'paid' (auto-approved)
            // If no SlipOK: keep 'pending_payment' with hasNewPayment flag for Admin to review
            const baseStatus = slipOkData ? 'paid' : 'pending_payment';
            const hasNewPayment = !slipOkData; // Flag for Admin to see new slip uploaded

            if (paymentType === 'chat') {
                const newChatId = uuidv4();
                const chatRef = doc(firestore, 'chats', newChatId);
                const chatPayload = {
                    participants: [user.uid, targetLawyerUserId],
                    createdAt: serverTimestamp(),
                    caseTitle: `Ticket สนทนา: ${initialMessage.substring(0, 30)}...`,
                    status: baseStatus,
                    slipUrl,
                    slipOkData: slipOkData || null,
                    lawyerId: lawyer.id,
                    userId: user.uid,
                    lastMessage: initialMessage,
                    lastMessageAt: serverTimestamp(),
                    amount: finalFee,
                    originalFee: fee,
                    discount: discountAmount,
                    couponCode: appliedCoupon?.code || null,
                    hasNewPayment,
                };

                await setDoc(chatRef, chatPayload);
                const messagesRef = collection(chatRef, 'messages');
                await addDoc(messagesRef, {
                    text: initialMessage,
                    senderId: user.uid,
                    timestamp: serverTimestamp(),
                });

                setPaymentSuccess(true);
            } else if (paymentType === 'appointment' && dateStr) {
                const appointmentRef = collection(firestore, 'appointments');
                const appointmentPayload = {
                    userId: user.uid,
                    lawyerId: lawyer.id,
                    lawyerUserId: targetLawyerUserId,
                    lawyerName: lawyer.name,
                    appointmentDate: new Date(dateStr),
                    description: description,
                    status: baseStatus,
                    createdAt: serverTimestamp(),
                    slipUrl,
                    slipOkData: slipOkData || null,
                    amount: finalFee,
                    originalFee: fee,
                    discount: discountAmount,
                    hasNewPayment,
                };

                await addDoc(appointmentRef, appointmentPayload);
                setPaymentSuccess(true);
            } else if (paymentType === 'installment' && chatId && installmentIndex !== null) {
                // ======= INSTALLMENT PAYMENT =======
                const result = await markInstallmentPaidAction({
                    chatId,
                    installmentIndex,
                    slipUrl,
                    slipOkData: slipOkData || null,
                    amount: finalFee,
                    payerName: user?.displayName || 'ลูกความ',
                });

                if (!result.success) {
                    toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: result.error });
                    setIsProcessing(false);
                    return;
                }

                setPaymentSuccess(true);

                // Fire email notifications (non-blocking)
                notifyPaymentCompletedAction({
                    chatId,
                    lawyerId: lawyerId || '',
                    amount: finalFee,
                    caseTitle: `งวดที่ ${installmentIndex + 1}`,
                    payerName: user?.displayName || 'ลูกความ',
                    isAutoApproved: !!slipOkData,
                }).catch(e => console.error('Installment payment notification failed:', e));

            } else if ((paymentType === 'additional' || paymentType === 'case') && chatId) {
                // ======= FULL CASE / ADDITIONAL PAYMENT =======
                const result = await markCasePaidAction({
                    chatId,
                    amount: finalFee,
                    slipUrl,
                    slipOkData: slipOkData || null,
                    payerName: user?.displayName || 'ลูกความ',
                    type: paymentType as 'case' | 'additional',
                });

                if (!result.success) {
                    toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: result.error });
                    setIsProcessing(false);
                    return;
                }

                setPaymentSuccess(true);

                notifyPaymentCompletedAction({
                    chatId: chatId || '',
                    lawyerId: lawyerId || '',
                    amount: finalFee,
                    caseTitle: paymentType === 'case' ? 'ค่าเปิดคดี' : 'ค่าบริการเพิ่มเติม',
                    payerName: user?.displayName || 'ลูกความ',
                    isAutoApproved: !!slipOkData,
                }).catch(e => console.error('Payment notification failed:', e));
            }
        } catch (error) {
            console.error("Payment error:", error);
            toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: "ไม่สามารถส่งข้อมูลได้" });
        } finally {
            setIsProcessing(false);
        }
    }

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];

            if (file.size > MAX_FILE_SIZE_BYTES) {
                toast({ variant: "destructive", title: "ไฟล์ใหญ่เกินไป", description: `ไม่เกิน ${MAX_FILE_SIZE_MB}MB` });
                return;
            }

            setSlipFile(file);
            setSlipPreview(URL.createObjectURL(file));
            setSlipOkData(null);
            setSlipVerificationFailed(false);

            const qrData = await scanSlipQR(file);
            if (qrData) {
                verifySlipWithSlipOK(qrData);
            } else {
                setSlipVerificationFailed(true);
                toast({ title: "ไม่พบคิวอาร์โค้ดในสลิป", description: "คุณยังสามารถแจ้งโอนได้ แต่อาจใช้เวลาตรวจสอบนานขึ้น" });
            }
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "คัดลอกแล้ว", description: text });
    };

    if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="animate-spin text-blue-600" /></div>;

    if (!lawyer) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <h2 className="text-xl font-bold">ไม่พบข้อมูลทนายความ</h2>
                <Button asChild variant="outline">
                    <Link href="/lawyers">กลับไปหน้าค้นหา</Link>
                </Button>
            </div>
        );
    }

    if (paymentSuccess) {
        return (
            <Card className="w-full max-w-2xl mx-auto border-none shadow-2xl rounded-3xl overflow-hidden mt-10">
                <div className="h-2 bg-green-500" />
                <CardContent className="pt-12 pb-12 text-center space-y-6">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800 mb-2">ส่งสลิปเรียบร้อยแล้ว</h2>
                        <p className="text-slate-500 max-w-md mx-auto">
                            เราได้รับหลักฐานการชำระเงินของคุณแล้ว {slipOkData ? "ระบบตรวจสอบเบื้องต้นผ่านแล้ว " : ""} เจ้าหน้าที่จะทำการอนุมัติในเวลาอันสั้น
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        {chatId && (
                            <Button asChild variant="outline" className="rounded-xl px-8 h-12 border-blue-200 text-blue-700 hover:bg-blue-50">
                                <Link href={`/chat/${chatId}?lawyerId=${lawyerId}`}>กลับไปยังห้องแชท</Link>
                            </Button>
                        )}
                        <Button asChild className="rounded-xl px-8 h-12 bg-[#0B3979] hover:bg-[#082a5a]">
                            <Link href="/dashboard">ไปที่แดชบอร์ด</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-12 mb-4 flex items-center justify-between">
               <Button variant="ghost" onClick={() => router.back()} className="text-slate-500 hover:bg-white/50 rounded-xl">
                  <ArrowLeft className="mr-2 h-4 w-4" /> ย้อนกลับ
               </Button>
               <div className="flex items-center gap-2 text-sm text-slate-400 bg-white/50 px-4 py-2 rounded-full border border-slate-100">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>ความปลอดภัยระดับธนาคาร</span>
               </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
                <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                    <CardHeader className="bg-[#0B3979] text-white p-8 md:p-10">
                        <div className="flex justify-between items-start mb-2">
                           <CardTitle className="text-2xl md:text-3xl font-headline tracking-tight">{title}</CardTitle>
                           <Landmark className="w-8 h-8 opacity-20" />
                        </div>
                        <CardDescription className="text-blue-100 text-base opacity-80">{descriptionText}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 md:p-10 space-y-10">
                        <div className="space-y-6">
                            <h3 className="font-bold text-xl flex items-center gap-3 text-slate-800">
                                <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm font-black">1</span>
                                โอนเงินผ่านมือถือของคุณ
                            </h3>
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl p-8 border border-slate-200/50 space-y-6 shadow-inner">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md overflow-hidden bg-white shrink-0 p-0.5 border border-slate-100">
                                            <img src="/images/logo-bank/กสิกร.png" alt="Kasikornbank" className="w-full h-full object-contain rounded-lg" />
                                        </div>
                                         <div>
                                          <p className="font-bold text-slate-700">KASIKORNBANK</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center group bg-white p-4 rounded-2xl border border-slate-200/50 shadow-sm">
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">เลขที่บัญชี</p>
                                        <p className="text-2xl md:text-3xl font-black text-[#0B3979] tracking-tighter">144-3-46310-7</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard('144-3-46310-7')} className="h-12 w-12 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors">
                                        <Copy className="w-5 h-5" />
                                    </Button>
                                </div>
                                <div className="flex justify-between items-center py-2 px-1">
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">ชื่อบัญชี</p>
                                        <p className="font-bold text-slate-700 text-lg">วิศรุต บุ่งอุทุม</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-bold text-xl flex items-center gap-3 text-slate-800">
                                <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm font-black">2</span>
                                แนบสลิปเพื่อแจ้งโอน
                            </h3>
                            <div className="space-y-4">
                               <div
                                  className={cn(
                                      "relative flex flex-col items-center justify-center w-full min-h-[200px] py-10 border-2 border-dashed rounded-[2.5rem] transition-all cursor-pointer group",
                                      slipFile ? "border-green-200 bg-green-50/50" : "border-slate-200 bg-slate-50/30 hover:border-blue-400 hover:bg-blue-50/50"
                                  )}
                                  onClick={() => fileInputRef.current?.click()}
                               >
                                  {slipPreview ? (
                                      <div className="absolute inset-4 rounded-[2rem] overflow-hidden shadow-2xl bg-white p-2">
                                         <img src={slipPreview} alt="Slip" className="w-full h-full object-contain" />
                                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <Button size="lg" className="rounded-2xl bg-white text-slate-800 hover:bg-slate-100 shadow-xl">เปลี่ยนรูปสลิป</Button>
                                         </div>
                                      </div>
                                  ) : (
                                      <div className="text-center space-y-4">
                                          <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto transition-transform group-hover:scale-110 duration-300">
                                              <Upload className="w-10 h-10" />
                                          </div>
                                          <div className="space-y-1">
                                              <p className="font-bold text-xl text-slate-700 font-headline">จุดวางไฟล์สลิป</p>
                                              <p className="text-sm text-slate-400">คลิกที่นี่เพื่อเลือกรูปจากมือถือหรือคอมพิวเตอร์</p>
                                          </div>
                                      </div>
                                  )}
                                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                               </div>

                               {isVerifyingSlip && (
                                   <div className="flex items-center justify-center gap-3 bg-blue-600 text-white p-5 rounded-2xl shadow-lg shadow-blue-200 animate-pulse">
                                       <Loader2 className="w-5 h-5 animate-spin" />
                                       <span className="font-bold tracking-wide">ระบบอัจฉริยะกำลังอ่านข้อมุลในสลิป...</span>
                                   </div>
                               )}

                               {slipOkData && (
                                   <div className="flex items-center gap-4 bg-white text-green-700 p-6 rounded-2xl border-2 border-green-500 shadow-xl shadow-green-100">
                                       <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-green-200">
                                          <CheckCircle className="w-6 h-6" />
                                       </div>
                                       <div>
                                           <p className="font-black text-lg leading-tight">ตรวจสอบเบื้องต้นสำเร็จ!</p>
                                           <p className="text-sm opacity-80 font-medium">พบยอดเงินในสลิป ฿{slipOkData.amount.toLocaleString()} (ถูกต้อง)</p>
                                       </div>
                                   </div>
                               )}

                               {slipVerificationFailed && !isVerifyingSlip && (
                                   <div className="flex bg-amber-50 rounded-2xl p-4 border border-amber-200 text-amber-800 gap-3 shadow-sm">
                                       <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                       <div className="text-sm">
                                           <p className="font-bold mb-1">ไม่สามารถตรวจสอบสลิปอัตโนมัติได้</p>
                                           <p>แต่คุณยังสามารถกดส่งสลิปนี้ได้ โดยแอดมินจะทำการตรวจสอบความถูกต้องให้คุณอีกครั้ง</p>
                                       </div>
                                   </div>
                               )}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="p-10 bg-slate-50 border-t border-slate-100 flex flex-col gap-4">
                        <Button
                            onClick={processPayment}
                            className={cn(
                                "w-full h-16 rounded-[1.5rem] text-xl font-black shadow-2xl active:scale-[0.98] transition-all disabled:grayscale disabled:opacity-50",
                                slipVerificationFailed ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/30" : "bg-[#0B3979] hover:bg-[#082a5a] shadow-blue-500/30"
                            )}
                            disabled={isProcessing || !slipFile}
                        >
                            {isProcessing ? <><Loader2 className="mr-3 animate-spin w-6 h-6" />กำลังบันทึกข้อมูล...</> : (slipVerificationFailed ? 'ส่งให้เจ้าหน้าที่ตรวจสอบสลิปนี้' : 'ยืนยันแจ้งชำระเงิน')}
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <div className="lg:col-span-5 space-y-6">
                <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden sticky top-24 bg-white">
                    <CardHeader className="border-b bg-white p-8">
                        <CardTitle className="text-xl font-bold text-slate-800">สรุปรายการคำขอ</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        <div className="flex items-center gap-5">
                            <Avatar className="h-16 w-16 ring-4 ring-slate-50 shadow-md">
                                <AvatarImage src={lawyer?.imageUrl} />
                                <AvatarFallback className="bg-[#0B3979] text-white font-bold">{lawyer?.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{paymentType === 'chat' ? 'Ticket สนทนากับ' : 'นัดนับรับบริการจาก'}</p>
                                <p className="font-extrabold text-xl text-slate-900 leading-tight">{lawyer?.name}</p>
                            </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-slate-100">
                            {paymentType === 'appointment' ? (
                                <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-4 rounded-2xl">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                    <span className="font-bold text-sm">{dateStr ? format(new Date(dateStr), 'd MMMM yyyy') : ''}</span>
                                </div>
                            ) : (
                                <div className="flex items-start gap-3 text-slate-600 bg-slate-50 p-4 rounded-2xl">
                                    <MessageSquare className="w-5 h-5 text-blue-600 shrink-0 mt-1" />
                                    <div className="space-y-1">
                                        <span className="font-bold text-sm leading-snug block">{paymentType === 'installment' ? (caseData?.caseTitle || 'ชำระค่าบริการตามงวด') : paymentType === 'case' ? (caseData?.caseTitle || 'ดำเนินคดีส่วนตัว') : 'ห้องสนทนาปรึกษากฎหมายส่วนตัว'}</span>
                                        {paymentType === 'installment' && installmentData && (
                                            <span className="text-xs text-blue-600 font-bold">งวดที่ {(installmentIndex ?? 0) + 1}: {installmentData.description}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4 pt-6 border-t border-slate-100 text-lg">
                           <div className="flex justify-between items-center text-slate-500 font-medium">
                              <span>ค่าธรรมเนียมเดิม</span>
                              <span className="line-through opacity-50">฿{fee.toLocaleString()}</span>
                           </div>
                           {appliedCoupon && (
                               <div className="flex justify-between items-center text-green-600 font-bold">
                                  <span>ส่วนลดสิทธิพิเศษ</span>
                                  <span>-฿{discountAmount.toLocaleString()}</span>
                               </div>
                           )}
                           <div className="flex justify-between items-baseline pt-4 text-slate-900 leading-none">
                              <span className="font-bold text-slate-400">ยอดสุทธิ</span>
                              <div className="text-right">
                                 <span className="text-4xl font-black italic tracking-tighter">฿{finalFee.toLocaleString()}</span>
                                 <p className="text-[10px] font-black text-slate-300 uppercase mt-1">Total Payable Amount</p>
                              </div>
                           </div>
                        </div>

                        <div className="pt-6">
                            <div className="relative group">
                                <Input
                                    placeholder="ใส่รหัสโปรโมชั่นที่นี่..."
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value)}
                                    className="rounded-2xl h-14 pl-12 font-bold border-slate-100 focus:border-blue-400 transition-all bg-slate-50/50"
                                    disabled={!!appliedCoupon || isCheckingCoupon}
                                />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                   <Pencil className="w-4 h-4" />
                                </div>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                  {appliedCoupon ? (
                                      <Button variant="ghost" size="sm" onClick={handleRemoveCoupon} className="text-red-500 hover:bg-red-50 rounded-xl">ยกเลิก</Button>
                                  ) : (
                                      <Button variant="link" onClick={handleApplyCoupon} disabled={!couponCode || isCheckingCoupon} className="text-[#0B3979] font-black underline decoration-2">
                                          {isCheckingCoupon ? <Loader2 className="animate-spin" /> : 'ใช้โค้ด'}
                                      </Button>
                                  )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-[#0B3979]/5 rounded-[2.5rem] p-8 border border-blue-100/50 flex gap-4 shadow-sm">
                   <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/5">
                      <AlertCircle className="w-6 h-6 text-blue-600" />
                   </div>
                   <div className="text-sm space-y-2">
                      <p className="font-black text-slate-800 text-base">การรับประกันโดย Lawslane</p>
                      <p className="text-slate-500 font-medium leading-relaxed italic">"เงินของท่านจะถูกเก็บรักษาไว้อย่างปลอดภัยในบัญชีส่วนกลาง และจะโอนให้ทนายความเมื่อได้รับบริการครบถ้วนแล้วเท่านั้น"</p>
                   </div>
                </div>
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
