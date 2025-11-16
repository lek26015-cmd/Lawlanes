
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, DollarSign, ShieldCheck, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

type WithdrawalStep = 'amount' | 'otp' | 'success';

export default function WithdrawPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();
  const [step, setStep] = useState<WithdrawalStep>('amount');
  const [otp, setOtp] = useState('');
  
  // Mock Data
  const currentBalance = 75000;
  const bankAccounts: BankAccount[] = [
    { id: 'ba1', bankName: 'ธนาคารกสิกรไทย', accountNumber: '...-X-X...-1234', accountName: 'นายสมชาย กฎหมายดี' },
    { id: 'ba2', bankName: 'ธนาคารไทยพาณิชย์', accountNumber: '...-X-X...-5678', accountName: 'นายสมชาย กฎหมายดี' }
  ];

  const handleProceedToOtp = () => {
    const amount = parseFloat(withdrawalAmount);
    if (!amount || amount <= 0) {
      toast({ variant: 'destructive', title: 'จำนวนเงินไม่ถูกต้อง', description: 'กรุณาระบุจำนวนเงินที่ต้องการถอน' });
      return;
    }
    if (amount > currentBalance) {
      toast({ variant: 'destructive', title: 'ยอดเงินไม่เพียงพอ' });
      return;
    }
    if (!selectedAccountId) {
      toast({ variant: 'destructive', title: 'ยังไม่ได้เลือกบัญชี', description: 'กรุณาเลือกบัญชีธนาคารเพื่อรับเงิน' });
      return;
    }
    setStep('otp');
  };
  
  const handleVerifyOtp = () => {
     if (otp.length !== 6) {
      toast({ variant: 'destructive', title: 'รหัส OTP ไม่ถูกต้อง', description: 'กรุณากรอกรหัส 6 หลักให้ครบถ้วน' });
      return;
    }
    // Simulate OTP verification
    console.log(`Withdrawing ${withdrawalAmount} to account ${selectedAccountId} with OTP ${otp}`);
    
    setStep('success');
    toast({ title: 'ส่งคำขอถอนเงินสำเร็จ', description: `ระบบกำลังดำเนินการถอนเงินจำนวน ${parseFloat(withdrawalAmount).toLocaleString()} บาท` });

    setTimeout(() => {
        router.push('/lawyer-earnings');
    }, 3000);
  };

  const renderContent = () => {
    switch (step) {
      case 'amount':
        return (
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="bank-account">เลือกบัญชีธนาคาร</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger id="bank-account">
                  <SelectValue placeholder="เลือกบัญชีที่จะรับเงิน" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.bankName} - {acc.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">จำนวนเงินที่ต้องการถอน</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="withdraw-amount"
                  type="number"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  placeholder="ระบุจำนวนเงิน"
                  className="pl-10 text-lg"
                />
              </div>
              <p className="text-sm text-muted-foreground">ยอดเงินที่ถอนได้: ฿{currentBalance.toLocaleString()}</p>
            </div>
          </CardContent>
        );
      case 'otp':
        return (
            <CardContent className="flex flex-col items-center gap-4">
                 <ShieldCheck className="w-16 h-16 text-primary"/>
                 <h3 className="font-semibold text-xl">ยืนยันตัวตน (2FA)</h3>
                <p className="text-muted-foreground text-center">
                    เราได้ส่งรหัส 6 หลักไปยังหมายเลขโทรศัพท์ที่ลงทะเบียนไว้ (xxx-xxx-1234) กรุณากรอกรหัสเพื่อยืนยันการถอนเงิน
                </p>
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    -
                    <InputOTPGroup>
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                    </InputOTPGroup>
                </InputOTP>
                <Button variant="link" size="sm" className="text-xs">ไม่ได้รับรหัส? ส่งอีกครั้ง</Button>
            </CardContent>
        );
      case 'success':
        return (
            <CardContent className="flex flex-col items-center gap-4 text-center">
                <CheckCircle className="w-16 h-16 text-green-500" />
                <h3 className="font-semibold text-xl">ส่งคำขอสำเร็จ</h3>
                <p className="text-muted-foreground">
                    ระบบได้รับคำขอถอนเงินของคุณแล้ว<br />
                    เงินจะเข้าบัญชีภายใน 1-2 วันทำการ
                </p>
                <p className="text-sm text-muted-foreground pt-4">กำลังนำคุณกลับไปหน้ารายได้...</p>
            </CardContent>
        );
    }
  };
  
  const renderFooter = () => {
    switch (step) {
      case 'amount':
        return (
          <CardFooter>
            <Button onClick={handleProceedToOtp} className="w-full" size="lg">ดำเนินการต่อ</Button>
          </CardFooter>
        );
      case 'otp':
        return (
          <CardFooter className="flex-col gap-2">
            <Button onClick={handleVerifyOtp} className="w-full" size="lg">ยืนยันการถอนเงิน</Button>
            <Button variant="ghost" onClick={() => setStep('amount')} className="w-full">ย้อนกลับ</Button>
          </CardFooter>
        );
      case 'success':
        return null;
    }
  }

  return (
    <div className="bg-gray-100/50 min-h-screen">
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="max-w-xl mx-auto space-y-6">
          <div>
            <Link href="/lawyer-earnings" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              กลับไปหน้ารายได้
            </Link>
            <h1 className="text-3xl font-bold font-headline">คำขอถอนเงิน</h1>
            <p className="text-muted-foreground">ทำตามขั้นตอนเพื่อถอนรายได้ของคุณ</p>
          </div>
          
          <Card>
            <CardHeader>
                <CardTitle>ขั้นตอนที่ {step === 'amount' ? 1 : 2}: {step === 'amount' ? 'ระบุข้อมูล' : 'ยืนยันตัวตน'}</CardTitle>
            </CardHeader>
            {renderContent()}
            {renderFooter()}
          </Card>
        </div>
      </div>
    </div>
  );
}
