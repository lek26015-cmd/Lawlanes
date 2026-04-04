'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, notFound } from 'next/navigation';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  User, 
  CreditCard, 
  CheckCircle, 
  Loader2, 
  Landmark, 
  Upload, 
  ShoppingBag,
  Truck
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/context/cart-context';
import { useFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp, getDocs, query, where, limit } from 'firebase/firestore';
import { uploadToR2 } from '@/app/actions/upload-r2';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QRCode from 'qrcode.react';
import generatePayload from 'promptpay-qr';
import Image from 'next/image';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/constants';
import { PromptPayLogo } from '@/components/ui/promptpay-logo';

export default function CheckoutPage() {
  const t = useTranslations('Books');
  const router = useRouter();
  const { toast } = useToast();
  const { items: cart, totalPrice: totalAmount, clearCart } = useCart();
  const { firestore, user, isUserLoading } = useFirebase();

  // Form State
  const [shippingInfo, setShippingInfo] = useState({
    name: user?.displayName || '',
    phone: '',
    address: '',
    district: '',
    province: '',
    zipCode: '',
  });

  const [activeTab, setActiveTab] = useState("bank-transfer");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [promptPayPayload, setPromptPayPayload] = useState('');

  const [discountAmount, setDiscountAmount] = useState(0);
  const [isFirstOrder, setIsFirstOrder] = useState(false);

  const shippingFee = cart.length > 0 ? 50 : 0;
  const subtotal = totalAmount;
  const finalTotal = subtotal + shippingFee - discountAmount;

  useEffect(() => {
    if (isUserLoading) return;

    if (cart.length === 0 && !isSuccess) {
      router.push('/books');
      return;
    }

    // Auth Guard
    if (!user && !isSuccess) {
        router.push(`/login?redirect=/books/checkout`);
        return;
    }

    // Check for first order discount
    const checkFirstOrder = async () => {
      if (user && firestore) {
        try {
          const q = query(
            collection(firestore, 'bookOrders'), 
            where('userId', '==', user.uid),
            limit(1)
          );
          const querySnapshot = await getDocs(q);
          
          if (querySnapshot.empty) {
            setIsFirstOrder(true);
            setDiscountAmount(totalAmount * 0.1);
          } else {
            setIsFirstOrder(false);
            setDiscountAmount(0);
          }
        } catch (error) {
          console.error("Error checking orders:", error);
        }
      }
    };

    checkFirstOrder();
  }, [cart, router, isSuccess, user, firestore, totalAmount, isUserLoading]);

  useEffect(() => {
    const mobileNumber = process.env.NEXT_PUBLIC_PROMPTPAY_NUMBER || '081-234-5678';
    const payload = generatePayload(mobileNumber, { amount: finalTotal });
    setPromptPayPayload(payload);
  }, [finalTotal]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setShippingInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
          variant: "destructive",
          title: "ไฟล์มีขนาดใหญ่เกินไป",
          description: `กรุณาอัปโหลดไฟล์ขนาดไม่เกิน ${MAX_FILE_SIZE_MB}MB`
        });
        return;
      }
      setSlipFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!shippingInfo.name || !shippingInfo.phone || !shippingInfo.address) {
      toast({
        variant: "destructive",
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณากรอกข้อมูลที่อยู่จัดส่งให้ครบถ้วน"
      });
      return;
    }

    if (!slipFile && activeTab === 'bank-transfer') {
      toast({
        variant: "destructive",
        title: "กรุณาแนบสลิป",
        description: "กรุณาอัปโหลดสลิปการโอนเงินเพื่อยืนยันรายการ"
      });
      return;
    }

    setIsProcessing(true);

    try {
      let slipUrl = '';
      if (slipFile) {
        const formData = new FormData();
        formData.append('file', slipFile);
        slipUrl = await uploadToR2(formData, 'book-payment-slips') as string;
      }

      const orderData = {
        userId: user?.uid || 'guest',
        items: cart.map((item: any) => ({
          bookId: item.id,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          imageUrl: item.imageUrl
        })),
        totalAmount: finalTotal,
        subtotal: totalAmount,
        discountAmount: discountAmount,
        shippingFee: shippingFee,
        shippingAddress: shippingInfo,
        paymentMethod: activeTab,
        paymentSlipUrl: slipUrl,
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      if (firestore) {
        await addDoc(collection(firestore, 'bookOrders'), orderData);
        clearCart();
        setIsSuccess(true);
        toast({
          title: "สั่งซื้อสำเร็จ!",
          description: "เราได้รับคำสั่งซื้อของคุณแล้ว",
        });
      }
    } catch (error) {
      console.error("Order error:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถบันทึกคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-gold animate-spin" />
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center py-12 px-6 rounded-3xl shadow-2xl border-none">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce-slow">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-deep-blue mb-4">สั่งซื้อสำเร็จ!</h2>
          <p className="text-slate-500 mb-10 leading-relaxed">
            ขอบคุณที่สั่งซื้อหนังสือกับ Lawslane ข้อมูลการสั่งซื้อของคุณถูกส่งไปยังเจ้าหน้าที่แล้ว เราจะดำเนินการตรวจสอบและจัดส่งให้คุณโดยเร็วที่สุด
          </p>
          <div className="space-y-4">
            <Button asChild className="w-full h-14 rounded-2xl bg-gold hover:bg-gold-dark text-white font-bold text-lg shadow-lg shadow-gold/20">
              <button onClick={() => router.push('/books/tracking')}>ติดตามสถานะคำสั่งซื้อ</button>
            </Button>
            <Button asChild variant="ghost" className="w-full h-14 rounded-2xl text-slate-400 hover:text-deep-blue font-bold">
              <button onClick={() => router.push('/books')}>กลับไปหน้าร้านค้า</button>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pt-32 pb-20">
      <div className="container mx-auto px-4 max-w-6xl">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-400 hover:text-[#D4AF37] transition-all mb-10 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold uppercase tracking-[0.2em] text-[10px]">Back to Store</span>
        </button>

        <h1 className="text-4xl font-extrabold text-[#1E293B] mb-16 flex items-center gap-5">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
            <ShoppingBag className="w-8 h-8 text-[#D4AF37]" />
          </div>
          {t('checkout.title') || 'Checkout'}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          {/* Form Side */}
          <div className="lg:col-span-7 space-y-12">
            <Card className="rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.03)] overflow-hidden bg-white">
              <CardHeader className="bg-white border-b border-slate-50 p-10">
                <CardTitle className="text-2xl font-black text-[#1E293B] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                  ที่อยู่จัดส่ง
                </CardTitle>
                <CardDescription className="text-slate-400 font-medium ml-14">กรุณาระบุสถานที่รับหนังสือให้ชัดเจน</CardDescription>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-600 font-bold ml-1">ชื่อผู้รับ</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        id="name" name="name" 
                        value={shippingInfo.name} onChange={handleInputChange}
                        className="h-12 pl-12 rounded-xl bg-slate-50 border-none focus:bg-white focus:ring-2 focus:ring-gold/20 transition-all font-medium" 
                        placeholder="ชื่อ-นามสกุล"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-slate-600 font-bold ml-1">เบอร์โทรศัพท์</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        id="phone" name="phone" 
                        value={shippingInfo.phone} onChange={handleInputChange}
                        className="h-12 pl-12 rounded-xl bg-slate-50 border-none focus:bg-white focus:ring-2 focus:ring-gold/20 transition-all font-medium" 
                        placeholder="08X-XXX-XXXX"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-slate-600 font-bold ml-1">ที่อยู่ (บ้านเลขที่, ถนน, ซอย)</Label>
                  <Textarea 
                    id="address" name="address" 
                    value={shippingInfo.address} onChange={handleInputChange}
                    className="min-h-[100px] rounded-xl bg-slate-50 border-none focus:bg-white focus:ring-2 focus:ring-gold/20 transition-all font-medium" 
                    placeholder="เลขที่บ้าน, หมู่บ้าน, อาคาร, ถนน..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="district" className="text-slate-600 font-bold ml-1">เขต/อำเภอ</Label>
                    <Input 
                      id="district" name="district" 
                      value={shippingInfo.district} onChange={handleInputChange}
                      className="h-12 rounded-xl bg-slate-50 border-none focus:bg-white focus:ring-2 focus:ring-gold/20 transition-all font-medium" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="province" className="text-slate-600 font-bold ml-1">จังหวัด</Label>
                    <Input 
                      id="province" name="province" 
                      value={shippingInfo.province} onChange={handleInputChange}
                      className="h-12 rounded-xl bg-slate-50 border-none focus:bg-white focus:ring-2 focus:ring-gold/20 transition-all font-medium" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode" className="text-slate-600 font-bold ml-1">รหัสไปรษณีย์</Label>
                    <Input 
                      id="zipCode" name="zipCode" 
                      value={shippingInfo.zipCode} onChange={handleInputChange}
                      className="h-12 rounded-xl bg-slate-50 border-none focus:bg-white focus:ring-2 focus:ring-gold/20 transition-all font-medium" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.03)] overflow-hidden bg-white">
              <CardHeader className="bg-white border-b border-slate-50 p-10">
                <CardTitle className="text-2xl font-black text-[#1E293B] flex items-center gap-4">
                   <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                  ช่องทางการชำระเงิน
                </CardTitle>
                <CardDescription className="text-slate-400 font-medium ml-14">เลือกวิธีที่คุณสะดวกในการชำระเงิน</CardDescription>
              </CardHeader>
              <CardContent className="p-10">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid grid-cols-2 h-16 bg-slate-50 p-1.5 rounded-2xl mb-10">
                    <TabsTrigger value="bank-transfer" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-[#D4AF37] data-[state=active]:shadow-lg data-[state=active]:shadow-slate-200/50 font-bold transition-all h-full">
                      <Landmark className="w-4 h-4 mr-2" />
                      โอนผ่านธนาคาร
                    </TabsTrigger>
                    <TabsTrigger value="promptpay" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-[#D4AF37] data-[state=active]:shadow-lg data-[state=active]:shadow-slate-200/50 font-bold transition-all h-full">
                      <PromptPayLogo width={24} height={24} className="mr-2 object-contain" />
                      พร้อมเพย์
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="bank-transfer" className="space-y-6">
                    <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-2xl border border-slate-100 items-center justify-center flex flex-col space-y-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm overflow-hidden bg-white p-0.5 border border-slate-100 mb-1">
                        <img src="/images/logo-bank/กสิกร.png" alt="Kasikornbank" className="w-full h-full object-contain rounded-lg" />
                      </div>
                      <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">ข้อมูลบัญชี</span>
                      <p className="text-lg font-bold text-deep-blue">ธนาคารกสิกรไทย</p>
                      <p className="text-2xl font-bold text-gold tracking-tighter">144-3-46310-7</p>
                      <p className="font-bold text-slate-600">วิศรุต บุ่งอุทุม</p>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-slate-600 font-bold ml-1">แนบหลักฐานการโอนเงิน</Label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative flex flex-col items-center justify-center w-full min-h-[160px] border-2 border-dashed border-slate-200 rounded-2xl hover:border-gold hover:bg-gold/5 cursor-pointer transition-all overflow-hidden"
                      >
                        {slipFile ? (
                           <div className="flex flex-col items-center gap-2 p-4">
                              <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
                              <span className="text-green-600 font-bold">{slipFile.name}</span>
                              <Button variant="ghost" size="sm" className="text-slate-400" onClick={(e) => { e.stopPropagation(); setSlipFile(null); }}>เปลี่ยนไฟล์</Button>
                           </div>
                        ) : (
                          <div className="text-center p-8">
                            <Upload className="w-10 h-10 text-slate-300 mx-auto mb-4 group-hover:text-gold transition-colors" />
                            <p className="text-slate-500 font-medium">คลิกเพื่ออัปโหลดรหือลากไฟล์รูปภาพสลิป</p>
                            <p className="text-xs text-slate-400 mt-2">JPG, PNG หรือ PDF ขนาดไม่เกิน 5MB</p>
                          </div>
                        )}
                        <input 
                          type="file" ref={fileInputRef} onChange={handleFileChange}
                          className="hidden" accept="image/*,.pdf" 
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="promptpay" className="flex flex-col items-center space-y-6">
                    <div className="p-6 bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 flex flex-col items-center">
                      <PromptPayLogo width={160} height={50} className="mb-6 object-contain" />
                      <div className="p-2 border-2 border-slate-100 rounded-2xl">
                        <QRCode value={promptPayPayload} size={220} />
                      </div>
                      <p className="mt-6 text-sm text-slate-400 font-medium italic">สแกนเพื่อชำระเงินจำนวน <span className="text-gold font-bold text-lg">฿{finalTotal.toLocaleString()}</span></p>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      className="w-full h-14 rounded-2xl border-gold text-gold hover:bg-gold hover:text-white font-bold"
                      onClick={() => setActiveTab('bank-transfer')}
                    >
                      ชำระเงินเสร็จแล้ว ยืนยันด้วยสลิป
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Summary Side */}
          <div className="lg:col-span-5">
            <div className="sticky top-32">
              <Card className="rounded-[2.5rem] border-none shadow-[0_40px_100px_rgba(0,0,0,0.06)] overflow-hidden bg-white">
                <CardHeader className="p-10 pb-6">
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-3xl font-black text-[#1E293B]">สรุปคำสั่งซื้อ</CardTitle>
                    <div className="w-12 h-12 bg-[#F8FAFC] rounded-2xl flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-[#D4AF37]" />
                    </div>
                  </div>
                  <CardDescription className="text-slate-400 font-medium tracking-wide">รายการหนังสือที่คุณเลือก</CardDescription>
                </CardHeader>
                <CardContent className="px-10 py-4 max-h-[350px] overflow-y-auto custom-scrollbar">
                  <div className="space-y-8">
                    {cart.map((item: any) => (
                      <div key={item.id} className="flex gap-6 items-center">
                        <div className="w-20 h-24 bg-slate-50 rounded-2xl overflow-hidden flex-shrink-0 relative shadow-sm">
                          <Image 
                            src={item.imageUrl} 
                            alt={item.title} 
                            fill 
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-extrabold text-[#1E293B] text-base line-clamp-2 leading-tight mb-1">{item.title}</h4>
                          <p className="text-slate-400 text-xs font-bold tracking-wider">QTY: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-[#1E293B] text-lg">฿{(item.price * item.quantity).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="p-8 bg-slate-50 flex-col gap-4 border-t border-slate-100">
                  <div className="w-full space-y-3">
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>ราคารวม</span>
                      <span>฿{totalAmount.toLocaleString()}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-green-600 font-bold bg-green-50 p-2 rounded-lg border border-green-100 italic">
                        <span className="flex items-center gap-2">
                          🎁 ส่วนลดสมาชิก 10%
                        </span>
                        <span>- ฿{discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span className="flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        ค่าจัดส่ง
                      </span>
                      <span>฿{shippingFee.toLocaleString()}</span>
                    </div>
                    <div className="pt-4 border-t border-slate-200 flex justify-between items-end">
                      <span className="text-deep-blue font-bold text-lg">ยอดรวมสุทธิ</span>
                      <span className="text-3xl font-bold text-gold">฿{finalTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  <Button 
                    onClick={handleSubmit} 
                    disabled={isProcessing || cart.length === 0}
                    className="w-full h-16 mt-4 rounded-2xl bg-gold hover:bg-gold-dark text-white font-bold text-lg shadow-lg shadow-gold/20 flex items-center justify-center gap-3 transition-all active:scale-95"
                  >
                    {isProcessing ? (
                      <><Loader2 className="w-6 h-6 animate-spin" /> กำลังตรวจสอบ...</>
                    ) : (
                      <>ยืนยันการสั่งซื้อ</>
                    )}
                  </Button>
                </CardFooter>
              </Card>

              {/* Trust Badge */}
              <div className="flex items-center justify-center gap-8 py-4 opacity-50 grayscale hover:grayscale-0 transition-all">
                <Image src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Visa_Logo.svg/2560px-Visa_Logo.svg.png" alt="Visa" width={50} height={16} className="object-contain" />
                <Image src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png" alt="Mastercard" width={40} height={24} className="object-contain" />
                <div className="h-8 w-px bg-slate-300" />
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Secure Payment</span>
                  <p className="text-[10px] font-bold text-deep-blue">SSL ENCRYPTED</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
