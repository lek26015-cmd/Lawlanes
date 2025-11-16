
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, DollarSign, Banknote, Landmark, Plus, Trash2, History, Hourglass, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"


type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
};

type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

type WithdrawalStep = 'amount' | 'otp' | 'success';


export default function LawyerEarningsPage() {
  const { toast } = useToast();
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();
  const [isWithdrawalDialogOpen, setIsWithdrawalDialogOpen] = useState(false);
  const [withdrawalStep, setWithdrawalStep] = useState<WithdrawalStep>('amount');
  const [otp, setOtp] = useState('');


  // Mock Data
  const currentBalance = 75000;
  const pendingBalance = 8500;
  const transactions: Transaction[] = [
    { id: 'txn1', date: '25 ก.ค. 2567', description: 'รายรับจากเคส #lcase-001', amount: 3500, type: 'credit' },
    { id: 'txn2', date: '24 ก.ค. 2567', description: 'รายรับจากเคส #lcase-002', amount: 5000, type: 'credit' },
    { id: 'txn3', date: '22 ก.ค. 2567', description: 'ถอนเงินเข้าบัญชี', amount: -10000, type: 'debit' },
    { id: 'txn4', date: '20 ก.ค. 2567', description: 'รายรับจากเคส #lcase-003', amount: 2500, type: 'credit' },
  ];
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([
    { id: 'ba1', bankName: 'ธนาคารกสิกรไทย', accountNumber: '...-X-X...-1234', accountName: 'นายสมชาย กฎหมายดี' }
  ]);
  
  // State for new bank account form
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [isAddAccountDialogOpen, setIsAddAccountDialogOpen] = useState(false);


  const monthlyData = [
    { month: "เม.ย.", total: 35000 },
    { month: "พ.ค.", total: 42000 },
    { month: "มิ.ย.", total: 68000 },
    { month: "ก.ค.", total: 75000 },
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
    setWithdrawalStep('otp');
  };
  
  const handleVerifyOtp = () => {
     if (otp.length !== 6) {
      toast({ variant: 'destructive', title: 'รหัส OTP ไม่ถูกต้อง', description: 'กรุณากรอกรหัส 6 หลักให้ครบถ้วน' });
      return;
    }
    // Simulate OTP verification
    console.log(`Withdrawing ${withdrawalAmount} to account ${selectedAccountId} with OTP ${otp}`);
    toast({ title: 'ส่งคำขอถอนเงินสำเร็จ', description: `ระบบกำลังดำเนินการถอนเงินจำนวน ${parseFloat(withdrawalAmount).toLocaleString()} บาท` });

    // Reset state and close dialog
    setWithdrawalAmount('');
    setSelectedAccountId(undefined);
    setOtp('');
    setWithdrawalStep('amount');
    setIsWithdrawalDialogOpen(false);
  }

  const handleAddNewAccount = () => {
    if (!newBankName || !newAccountNumber || !newAccountName) {
      toast({ variant: 'destructive', title: 'ข้อมูลไม่ครบถ้วน', description: 'กรุณากรอกข้อมูลบัญชีธนาคารให้ครบถ้วน' });
      return;
    }
    
    const newAccount: BankAccount = {
      id: `ba${bankAccounts.length + 1}`,
      bankName: newBankName,
      accountNumber: `...-X-X...-${newAccountNumber.slice(-4)}`, // Masking for display
      accountName: newAccountName
    };
    
    setBankAccounts([...bankAccounts, newAccount]);
    
    // Reset form and close dialog
    setNewBankName('');
    setNewAccountNumber('');
    setNewAccountName('');
    setIsAddAccountDialogOpen(false);
    
    toast({ title: 'เพิ่มบัญชีธนาคารสำเร็จ' });
  };
  
  const resetAndCloseWithdrawal = () => {
    setIsWithdrawalDialogOpen(false);
    // Use a timeout to reset state after the dialog has closed to avoid visual glitches
    setTimeout(() => {
        setWithdrawalStep('amount');
        setWithdrawalAmount('');
        setSelectedAccountId(undefined);
        setOtp('');
    }, 300);
  }


  return (
    <div className="bg-gray-100/50 min-h-screen">
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <Link href="/lawyer-dashboard" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              กลับไปที่แดชบอร์ด
            </Link>
            <h1 className="text-3xl font-bold font-headline">รายได้และการถอนเงิน</h1>
            <p className="text-muted-foreground">จัดการรายรับและช่องทางการเงินของคุณ</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base font-semibold">
                        <span>ยอดเงินคงเหลือที่ถอนได้</span>
                        <DollarSign />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold tracking-tight">฿{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </CardContent>
                <CardFooter>
                    <Dialog open={isWithdrawalDialogOpen} onOpenChange={setIsWithdrawalDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="default" className="w-full sm:w-auto">
                                <Banknote className="mr-2"/> ถอนเงิน
                            </Button>
                        </DialogTrigger>
                        <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-md">
                           {withdrawalStep === 'amount' && (
                             <>
                                <DialogHeader>
                                    <DialogTitle>คำขอถอนเงิน</DialogTitle>
                                    <DialogDescription>เลือกบัญชีและระบุจำนวนเงินที่ต้องการถอน</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
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
                                        <Label htmlFor="withdraw-amount">จำนวนเงิน (สูงสุด ฿{currentBalance.toLocaleString()})</Label>
                                        <Input 
                                            id="withdraw-amount" 
                                            type="number" 
                                            value={withdrawalAmount}
                                            onChange={(e) => setWithdrawalAmount(e.target.value)}
                                            placeholder="เช่น 5000"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="secondary" onClick={resetAndCloseWithdrawal}>ยกเลิก</Button>
                                    <Button type="button" onClick={handleProceedToOtp}>ดำเนินการต่อ</Button>
                                </DialogFooter>
                             </>
                           )}
                           {withdrawalStep === 'otp' && (
                                <>
                                 <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2"><ShieldCheck/> ยืนยันตัวตน (2FA)</DialogTitle>
                                    <DialogDescription>
                                        เราได้ส่งรหัส 6 หลักไปยังหมายเลขโทรศัพท์ที่ลงทะเบียนไว้ (xxx-xxx-1234) กรุณากรอกรหัสเพื่อยืนยันการถอนเงิน
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex flex-col items-center gap-4 py-4">
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
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="secondary" onClick={() => setWithdrawalStep('amount')}>ย้อนกลับ</Button>
                                    <Button type="button" onClick={handleVerifyOtp}>ยืนยันการถอนเงิน</Button>
                                </DialogFooter>
                               </>
                           )}
                        </DialogContent>
                    </Dialog>
                </CardFooter>
            </Card>

            <Card className="bg-secondary text-secondary-foreground shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base font-semibold text-muted-foreground">
                        <span>ยอดเงินรอเคลียร์ (จากเคสที่กำลังทำ)</span>
                        <Hourglass />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold tracking-tight">฿{pendingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </CardContent>
                 <CardFooter>
                    <p className="text-xs text-muted-foreground">ยอดเงินจะถูกโอนเข้าสู่ยอดที่ถอนได้เมื่อเคสเสร็จสิ้น</p>
                </CardFooter>
            </Card>
          </div>

          <Tabs defaultValue="history">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="history"><History className="mr-2"/>ประวัติธุรกรรม</TabsTrigger>
                <TabsTrigger value="accounts"><Landmark className="mr-2"/>บัญชีธนาคาร</TabsTrigger>
            </TabsList>
            <TabsContent value="history">
                <Card>
                    <CardHeader>
                        <CardTitle>ประวัติธุรกรรมล่าสุด</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>วันที่</TableHead>
                                    <TableHead>รายการ</TableHead>
                                    <TableHead className="text-right">จำนวนเงิน (บาท)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell className={`text-right font-semibold ${tx.type === 'credit' ? 'text-green-600' : 'text-destructive'}`}>
                                            {tx.type === 'credit' ? '+' : ''}{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="accounts">
                <Card>
                    <CardHeader>
                        <CardTitle>จัดการบัญชีธนาคาร</CardTitle>
                        <CardDescription>บัญชีสำหรับรับเงินค่าบริการ</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {bankAccounts.map(acc => (
                            <div key={acc.id} className="flex justify-between items-center p-4 border rounded-lg bg-secondary/30">
                                <div className="flex items-center gap-4">
                                    <Landmark className="w-8 h-8 text-muted-foreground" />
                                    <div>
                                        <p className="font-semibold">{acc.bankName}</p>
                                        <p className="text-sm text-muted-foreground">{acc.accountName} - {acc.accountNumber}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon">
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                        <Dialog open={isAddAccountDialogOpen} onOpenChange={setIsAddAccountDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full border-dashed">
                                    <Plus className="mr-2"/> เพิ่มบัญชีธนาคารใหม่
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                <DialogTitle>เพิ่มบัญชีธนาคารใหม่</DialogTitle>
                                <DialogDescription>
                                    กรอกข้อมูลบัญชีธนาคารสำหรับรับเงินค่าบริการ
                                </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="bank-name" className="text-right">
                                    ชื่อธนาคาร
                                    </Label>
                                    <Input id="bank-name" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} className="col-span-3" placeholder="เช่น ธนาคารกสิกรไทย" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="account-number" className="text-right">
                                    เลขที่บัญชี
                                    </Label>
                                    <Input id="account-number" value={newAccountNumber} onChange={(e) => setNewAccountNumber(e.target.value)} className="col-span-3" placeholder="xxxxxxxxxx" />
                                </div>
                                 <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="account-name" className="text-right">
                                    ชื่อบัญชี
                                    </Label>
                                    <Input id="account-name" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className="col-span-3" placeholder="นายสมชาย กฎหมายดี" />
                                </div>
                                </div>
                                <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary">ยกเลิก</Button>
                                </DialogClose>
                                <Button type="button" onClick={handleAddNewAccount}>ยืนยัน</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>สถิติรายได้รายเดือน</CardTitle>
              <CardDescription>ภาพรวมรายได้ในช่วง 4 เดือนที่ผ่านมา</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `฿${new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value as number)}`}
                  />
                   <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)'
                    }}
                    cursor={{ fill: 'hsl(var(--accent))' }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
