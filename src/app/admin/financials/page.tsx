
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, DollarSign, Banknote, Landmark, Gavel, Home, Users2, ShieldCheck, Ticket } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Badge } from '@/components/ui/badge';

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'revenue' | 'fee' | 'payout';
  status: 'completed' | 'pending';
};

export default function AdminFinancialsPage() {

  // Mock Data
  const totalRevenue = 1259345;
  const currentMonthRevenue = 125350;
  const totalFees = totalRevenue * 0.15; // Assuming 15% platform fee
  
  const transactions: Transaction[] = [
    { id: 'txn1', date: '28 ก.ค. 2567', description: 'ค่าบริการเคส #case-001', amount: 3500, type: 'revenue', status: 'completed' },
    { id: 'txn2', date: '27 ก.ค. 2567', description: 'ค่าธรรมเนียมแพลตฟอร์ม #case-001', amount: -525, type: 'fee', status: 'completed' },
    { id: 'txn3', date: '27 ก.ค. 2567', description: 'จ่ายเงินให้ทนาย #l-payout-012', amount: -2975, type: 'payout', status: 'completed' },
    { id: 'txn4', date: '26 ก.ค. 2567', description: 'ค่าบริการเคส #case-002', amount: 5000, type: 'revenue', status: 'completed' },
    { id: 'txn5', date: '25 ก.ค. 2567', description: 'ค่าบริการเคส #case-003', amount: 8000, type: 'revenue', status: 'pending' },
  ];
  
  const monthlyData = [
    { month: "เม.ย.", total: 350000 },
    { month: "พ.ค.", total: 420000 },
    { month: "มิ.ย.", total: 680000 },
    { month: "ก.ค.", total: totalRevenue - (350000+420000+680000) }, // Simplified calculation
  ];

  const transactionTypeBadges: { [key in Transaction['type']]: React.ReactNode } = {
    revenue: <Badge variant="secondary" className="bg-blue-100 text-blue-800">รายรับ</Badge>,
    fee: <Badge variant="secondary" className="bg-green-100 text-green-800">ค่าธรรมเนียม</Badge>,
    payout: <Badge variant="outline" className="text-orange-700 border-orange-500">จ่ายทนาย</Badge>,
  };

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[280px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <Gavel className="h-6 w-6" />
              <span className="">Lawlanes Admin</span>
            </Link>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <ArrowLeft className="h-4 w-4" /> กลับไปหน้าแรก
              </Link>
              <Link href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <Home className="h-4 w-4" /> แดชบอร์ด
              </Link>
              <Link href="/admin/customers" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <Users2 className="h-4 w-4" /> ลูกค้า
              </Link>
              <Link href="/admin/lawyers" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <ShieldCheck className="h-4 w-4" /> ทนายความ
              </Link>
              <Link href="/admin/financials" className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-primary transition-all hover:text-primary">
                <Landmark className="h-4 w-4" /> การเงิน
              </Link>
              <Link href="/admin/tickets" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                <Ticket className="h-4 w-4" /> Ticket ช่วยเหลือ
              </Link>
            </nav>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>ภาพรวมการเงิน</CardTitle>
                    <CardDescription>สรุปรายรับและธุรกรรมทั้งหมดของแพลตฟอร์ม</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">รายได้รวมทั้งหมด</CardTitle>
                                <DollarSign className="w-4 h-4 text-muted-foreground"/>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">฿{totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">รายได้เดือนนี้</CardTitle>
                                <DollarSign className="w-4 h-4 text-muted-foreground"/>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-green-600">฿{currentMonthRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">ค่าธรรมเนียมรวม</CardTitle>
                                <Banknote className="w-4 h-4 text-muted-foreground"/>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">฿{totalFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>สถิติรายได้รายเดือน</CardTitle>
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

                    <Card className="mt-8">
                        <CardHeader>
                            <CardTitle>ประวัติธุรกรรมล่าสุด</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>วันที่</TableHead>
                                        <TableHead>รายการ</TableHead>
                                        <TableHead>ประเภท</TableHead>
                                        <TableHead>สถานะ</TableHead>
                                        <TableHead className="text-right">จำนวนเงิน (บาท)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell>{transactionTypeBadges[tx.type]}</TableCell>
                                            <TableCell>
                                                <Badge variant={tx.status === 'completed' ? 'secondary' : 'outline'}>
                                                    {tx.status === 'completed' ? 'สำเร็จ' : 'รอดำเนินการ'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={`text-right font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-destructive'}`}>
                                                {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </main>
      </div>
    </div>
  );
}
