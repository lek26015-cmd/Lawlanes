
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, DollarSign, Banknote, Landmark, Gavel, Home, Users2, ShieldCheck, Ticket, TrendingUp, HandCoins } from 'lucide-react';
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
  const totalServiceValue = 1259345;
  const platformRevenueThisMonth = 18802.50;
  const platformTotalRevenue = totalServiceValue * 0.15; // Assuming 15% platform fee
  
  const transactions: Transaction[] = [
    { id: 'txn1', date: '28 ก.ค. 2567', description: 'ค่าบริการเคส #case-001', amount: 3500, type: 'revenue', status: 'completed' },
    { id: 'txn2', date: '27 ก.ค. 2567', description: 'ส่วนแบ่งรายได้แพลตฟอร์ม #case-001', amount: 525, type: 'fee', status: 'completed' },
    { id: 'txn3', date: '27 ก.ค. 2567', description: 'จ่ายเงินให้ทนาย #l-payout-012', amount: -2975, type: 'payout', status: 'completed' },
    { id: 'txn4', date: '26 ก.ค. 2567', description: 'ค่าบริการเคส #case-002', amount: 5000, type: 'revenue', status: 'completed' },
    { id: 'txn5', date: '25 ก.ค. 2567', description: 'ค่าบริการเคส #case-003', amount: 8000, type: 'revenue', status: 'pending' },
  ];
  
  const monthlyData = [
    { month: "เม.ย.", total: 52500 },
    { month: "พ.ค.", total: 63000 },
    { month: "มิ.ย.", total: 102000 },
    { month: "ก.ค.", total: platformRevenueThisMonth },
  ];

  const transactionTypeBadges: { [key in Transaction['type']]: React.ReactNode } = {
    revenue: <Badge variant="secondary" className="bg-blue-100 text-blue-800">เงินเข้า</Badge>,
    fee: <Badge variant="secondary" className="bg-green-100 text-green-800">รายได้แพลตฟอร์ม</Badge>,
    payout: <Badge variant="outline" className="text-orange-700 border-orange-500">จ่ายทนาย</Badge>,
  };

  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <Card>
              <CardHeader>
                  <CardTitle>ภาพรวมการเงิน</CardTitle>
                  <CardDescription>สรุปธุรกรรมและรายได้ทั้งหมดของแพลตฟอร์ม Lawlanes</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <Card>
                          <CardHeader className="flex flex-row items-center justify-between pb-2">
                              <CardTitle className="text-sm font-medium">ยอดค่าบริการรวม</CardTitle>
                              <DollarSign className="w-4 h-4 text-muted-foreground"/>
                          </CardHeader>
                          <CardContent>
                              <div className="text-3xl font-bold">฿{totalServiceValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                              <CardDescription>มูลค่าธุรกรรมทั้งหมดในระบบ</CardDescription>
                          </CardContent>
                      </Card>
                       <Card>
                          <CardHeader className="flex flex-row items-center justify-between pb-2">
                              <CardTitle className="text-sm font-medium">รายได้แพลตฟอร์ม (เดือนนี้)</CardTitle>
                              <TrendingUp className="w-4 h-4 text-muted-foreground"/>
                          </CardHeader>
                          <CardContent>
                              <div className="text-3xl font-bold text-green-600">฿{platformRevenueThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                               <CardDescription>ส่วนแบ่งรายได้ในเดือนปัจจุบัน</CardDescription>
                          </CardContent>
                      </Card>
                       <Card>
                          <CardHeader className="flex flex-row items-center justify-between pb-2">
                              <CardTitle className="text-sm font-medium">รายได้แพลตฟอร์ม (ทั้งหมด)</CardTitle>
                              <HandCoins className="w-4 h-4 text-muted-foreground"/>
                          </CardHeader>
                          <CardContent>
                              <div className="text-3xl font-bold">฿{platformTotalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                               <CardDescription>ส่วนแบ่งรายได้ทั้งหมดของแพลตฟอร์ม</CardDescription>
                          </CardContent>
                      </Card>
                  </div>

                  <Card>
                      <CardHeader>
                          <CardTitle>สถิติรายได้แพลตฟอร์มรายเดือน</CardTitle>
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
                              formatter={(value: number) => [value.toLocaleString('en-US', { minimumFractionDigits: 2 }), 'รายได้']}
                          />
                          <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                      </CardContent>
                  </Card>

                  <Card className="mt-8">
                      <CardHeader>
                          <CardTitle>รายการธุรกรรมล่าสุด</CardTitle>
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
                                          <TableCell className={`text-right font-semibold ${tx.type === 'fee' ? 'text-green-600' : tx.amount > 0 ? '' : 'text-destructive'}`}>
                                               {tx.type === 'fee' ? `+${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
  );
}
