
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, DollarSign, Banknote, Landmark, Plus, Trash2, History, Hourglass } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';

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

export default function LawyerEarningsPage() {
  const { toast } = useToast();
  const [withdrawalAmount, setWithdrawalAmount] = useState('');

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

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawalAmount);
    if (!amount || amount <= 0) {
      toast({ variant: 'destructive', title: 'จำนวนเงินไม่ถูกต้อง', description: 'กรุณาระบุจำนวนเงินที่ต้องการถอน' });
      return;
    }
    if (amount > currentBalance) {
      toast({ variant: 'destructive', title: 'ยอดเงินไม่เพียงพอ' });
      return;
    }
    
    // Logic to process withdrawal
    console.log(`Withdrawing ${amount}`);
    toast({ title: 'ส่งคำขอถอนเงินสำเร็จ', description: `ระบบกำลังดำเนินการถอนเงินจำนวน ${amount.toLocaleString()} บาท` });
    setWithdrawalAmount('');
  };

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
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
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
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="secondary" className="w-full sm:w-auto bg-white/20 hover:bg-white/30 text-white">
                            <Banknote className="mr-2"/> ถอนเงิน
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>คำขอถอนเงิน</AlertDialogTitle>
                            <AlertDialogDescription>
                                กรอกจำนวนเงินที่ต้องการถอน (สูงสุด ฿{currentBalance.toLocaleString()})
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-2">
                                <Label htmlFor="withdraw-amount">จำนวนเงิน (บาท)</Label>
                                <Input 
                                    id="withdraw-amount" 
                                    type="number" 
                                    value={withdrawalAmount}
                                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                                    placeholder="เช่น 5000"
                                />
                            </div>
                            <AlertDialogFooter>
                            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                            <AlertDialogAction onClick={handleWithdraw}>ยืนยันการถอนเงิน</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardFooter>
            </Card>

            <Card className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base font-semibold">
                        <span>ยอดเงินรอเคลียร์ (จากเคสที่กำลังทำ)</span>
                        <Hourglass />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold tracking-tight">฿{pendingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </CardContent>
                 <CardFooter>
                    <p className="text-xs text-blue-100">ยอดเงินจะถูกโอนเข้าสู่ยอดที่ถอนได้เมื่อเคสเสร็จสิ้น</p>
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
                         <Button variant="outline" className="w-full border-dashed">
                           <Plus className="mr-2"/> เพิ่มบัญชีธนาคารใหม่
                        </Button>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </div>
  );
}
