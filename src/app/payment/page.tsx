
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getLawyerById } from '@/lib/data';
import type { LawyerProfile } from '@/lib/types';
import { ArrowLeft, CreditCard, Calendar, User, CheckCircle, QrCode, MessageSquare, Pencil } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QRCode from 'qrcode.react';
import generatePayload from 'promptpay-qr';
import { useChat } from '@/context/chat-context';
import { Textarea } from '@/components/ui/textarea';
import { v4 as uuidv4 } from 'uuid';
import { useFirebase } from '@/firebase';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';


function PaymentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { setInitialChatMessage } = useChat();
  const { firestore, user } = useFirebase();

  const paymentType = searchParams.get('type') || 'appointment';
  const lawyerId = searchParams.get('lawyerId');
  const dateStr = searchParams.get('date');
  const description = searchParams.get('description');

  const [lawyer, setLawyer] = useState<LawyerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [promptPayPayload, setPromptPayPayload] = useState('');
  const [initialMessage, setInitialMessage] = useState(description || '');

  const appointmentFee = 3500;
  const chatTicketFee = 500;
  const fee = paymentType === 'chat' ? chatTicketFee : appointmentFee;
  const title = paymentType === 'chat' ? 'ยืนยันการเปิด Ticket สนทนา' : 'ยืนยันการนัดหมายและชำระเงิน';
  const descriptionText = paymentType === 'chat' ? 'กรุณาตรวจสอบรายละเอียดและดำเนินการชำระเงินค่าเปิด Ticket' : 'กรุณาตรวจสอบรายละเอียดและดำเนินการชำระเงินค่าปรึกษา';

  useEffect(() => {
    async function fetchLawyer() {
      if (!lawyerId || !firestore) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const lawyerData = await getLawyerById(firestore, lawyerId);
      setLawyer(lawyerData || null);
      setIsLoading(false);
    }
    fetchLawyer();
  }, [lawyerId, firestore]);
  
  useEffect(() => {
    // This is a mock phone number for QR generation
    const mobileNumber = '081-234-5678'; 
    const payload = generatePayload(mobileNumber, { amount: fee });
    setPromptPayPayload(payload);
  }, [fee]);

  const handlePayment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!firestore || !user || !lawyer) {
        toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้" });
        return;
    }

    if(paymentType === 'chat' && !initialMessage.trim()){
        toast({
            variant: "destructive",
            title: "ข้อมูลไม่ครบถ้วน",
            description: "กรุณาพิมพ์คำถามแรกที่จะส่งถึงทนายความ",
        });
        return;
    }

    setIsProcessing(true);
    
    try {
        if (paymentType === 'chat') {
            const newChatId = uuidv4();
            const chatRef = doc(firestore, 'chats', newChatId);
            const messagesRef = collection(chatRef, 'messages');

            await setDoc(chatRef, {
                participants: [user.uid, lawyer.userId],
                createdAt: serverTimestamp(),
                caseTitle: `Ticket สนทนา: ${initialMessage.substring(0, 30)}...`,
                status: 'active',
            });

            await addDoc(messagesRef, {
                text: initialMessage,
                senderId: user.uid,
                timestamp: serverTimestamp(),
            });

            toast({
                title: "ชำระเงินสำเร็จ!",
                description: 'คุณสามารถเริ่มสนทนากับทนายความได้แล้ว',
            });
            
            router.push(`/chat/${newChatId}?lawyerId=${lawyer.id}`);

        } else if (paymentType === 'appointment' && dateStr) {
            const appointmentRef = collection(firestore, 'appointments');
            await addDoc(appointmentRef, {
                userId: user.uid,
                lawyerId: lawyer.id,
                lawyerName: lawyer.name,
                lawyerImageUrl: lawyer.imageUrl,
                appointmentDate: new Date(dateStr),
                description: description,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            setPaymentSuccess(true);
            toast({
                title: "ชำระเงินสำเร็จ!",
                description: 'เราได้ส่งคำขอนัดหมายของคุณไปยังทนายความแล้ว',
            });
             setTimeout(() => {
                router.push(`/dashboard`);
            }, 3000);
        }
    } catch (error) {
        console.error("Payment processing error:", error);
        toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง" });
    } finally {
        setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]">Loading...</div>;
  }

  if (!lawyer || (paymentType === 'appointment' && !dateStr)) {
    return (
      <div className="text-center">
        <p className="mb-4">ข้อมูลการชำระเงินไม่ถูกต้อง</p>
        <Link href="/lawyers">
          <Button variant="outline">กลับไปหน้ารายชื่อทนาย</Button>
        </Link>
      </div>
    );
  }
  
  if (paymentSuccess && paymentType === 'appointment') {
    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">การนัดหมายของคุณถูกส่งแล้ว</h2>
                <p className="text-muted-foreground mb-4">
                    เราได้ส่งรายละเอียดการนัดหมายกับคุณ {lawyer.name} ในวันที่ {dateStr ? format(new Date(dateStr), 'd MMMM yyyy') : ''} ไปยังทนายความแล้ว (จำลอง)
                </p>
                <p className="text-sm text-muted-foreground">กำลังนำคุณกลับไปที่แดชบอร์ด...</p>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-3">
            {title}
        </CardTitle>
        <CardDescription>
          {descriptionText}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">สรุปรายการ</h3>
            <Card className="bg-secondary/50 rounded-lg overflow-hidden">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4 mb-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={lawyer.imageUrl} alt={lawyer.name} />
                            <AvatarFallback>{lawyer.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{paymentType === 'chat' ? 'สนทนากับคุณ' : 'ปรึกษาคุณ'}</p>
                            <p className="text-lg font-bold">{lawyer.name}</p>
                        </div>
                    </div>
                     <div className="space-y-4 text-sm">
                        {paymentType === 'appointment' ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                    <span><span className="font-semibold">วันที่:</span> {dateStr ? format(new Date(dateStr), 'd MMMM yyyy') : ''}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <User className="w-4 h-4 text-muted-foreground mt-1" />
                                    <span><span className="font-semibold">หัวข้อ:</span> {description}</span>
                                </div>
                            </>
                        ) : (
                             <>
                                <div className="flex items-start gap-2">
                                    <MessageSquare className="w-4 h-4 text-muted-foreground mt-1" />
                                    <span><span className="font-semibold">บริการ:</span> เปิด Ticket เพื่อเริ่มต้นการสนทนาส่วนตัว</span>
                                </div>
                                <div className="flex items-start gap-2">
                                     <Pencil className="w-4 h-4 text-muted-foreground mt-1" />
                                     <div className="w-full">
                                        <Label htmlFor="initial-message" className="font-semibold">คำถามแรกถึงทนายความ</Label>
                                        <Textarea 
                                            id="initial-message"
                                            placeholder="อธิบายปัญหาของคุณโดยย่อ..."
                                            value={initialMessage}
                                            onChange={(e) => setInitialMessage(e.target.value)}
                                            className="mt-1 bg-white"
                                            rows={4}
                                        />
                                     </div>
                                </div>
                             </>
                        )}
                     </div>
                </CardContent>
                 <CardFooter className="bg-secondary">
                    <div className="w-full flex justify-between items-center font-bold">
                        <span>ค่าบริการ</span>
                        <span>{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(fee)}</span>
                    </div>
                </CardFooter>
            </Card>
        </div>

        <div className="space-y-4">
            <h3 className="font-semibold text-lg">เลือกวิธีการชำระเงิน</h3>
            <Tabs defaultValue="promptpay" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="credit-card"><CreditCard className="mr-2 h-4 w-4" /> บัตรเครดิต</TabsTrigger>
                    <TabsTrigger value="promptpay"><QrCode className="mr-2 h-4 w-4" /> PromptPay</TabsTrigger>
                </TabsList>
                <TabsContent value="credit-card" className="mt-4">
                     <form onSubmit={handlePayment} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cardNumber">หมายเลขบัตรเครดิต</Label>
                            <Input id="cardNumber" placeholder="0000 0000 0000 0000" disabled={isProcessing} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="expiryDate">วันหมดอายุ (MM/YY)</Label>
                                <Input id="expiryDate" placeholder="MM/YY" disabled={isProcessing} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cvc">CVC</Label>
                                <Input id="cvc" placeholder="123" disabled={isProcessing} />
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="cardName">ชื่อบนบัตร</Label>
                            <Input id="cardName" placeholder="สมชาย กฎหมายดี" disabled={isProcessing} />
                        </div>
                        <Button type="submit" className="w-full" size="lg" disabled={isProcessing}>
                            {isProcessing ? 'กำลังดำเนินการ...' : `ยืนยันและชำระเงิน ${new Intl.NumberFormat('th-TH').format(fee)} บาท`}
                        </Button>
                     </form>
                </TabsContent>
                <TabsContent value="promptpay" className="mt-4">
                    <div className="flex flex-col items-center justify-center space-y-4 p-4 border rounded-md bg-white">
                        <p className="font-semibold">สแกน QR Code เพื่อชำระเงิน</p>
                        <div className="p-4 bg-white rounded-lg">
                           <QRCode value={promptPayPayload} size={180} />
                        </div>
                        <p className="text-sm text-muted-foreground">ยอดชำระ: {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(fee)}</p>
                        <p className="text-xs text-muted-foreground text-center">ใช้แอปพลิเคชันธนาคารของคุณสแกน QR Code นี้เพื่อชำระเงิน</p>
                         <Button onClick={() => handlePayment()} className="w-full mt-4" size="lg" disabled={isProcessing}>
                            {isProcessing ? 'กำลังตรวจสอบ...' : `ตรวจสอบการชำระเงิน`}
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}


export default function PaymentPage() {
    return (
        <div className="bg-gray-50 min-h-screen py-12">
            <div className="container mx-auto px-4 md:px-6">
                 <Suspense fallback={<div>Loading payment details...</div>}>
                    <PaymentPageContent />
                </Suspense>
            </div>
        </div>
    )
}
