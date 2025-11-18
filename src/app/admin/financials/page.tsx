
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, DollarSign, Banknote, Landmark, Gavel, Home, Users2, ShieldCheck, Ticket, TrendingUp, HandCoins, FileDown, Calendar as CalendarIcon } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Badge } from '@/components/ui/badge';
import React, { useState, useEffect, useMemo } from 'react';
import { format, getMonth, getYear, isWithinInterval, parse, startOfMonth, endOfMonth } from 'date-fns';
import { th } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'revenue' | 'fee' | 'payout';
  status: 'completed' | 'pending';
};

// Expanded mock data for multiple months
const allTransactions: Transaction[] = [
    { id: 'txn1', date: '28 ก.ค. 2567', description: 'ค่าบริการเคส #case-001', amount: 3500, type: 'revenue', status: 'completed' },
    { id: 'txn2', date: '27 ก.ค. 2567', description: 'ส่วนแบ่งรายได้แพลตฟอร์ม #case-001', amount: 525, type: 'fee', status: 'completed' },
    { id: 'txn3', date: '27 ก.ค. 2567', description: 'จ่ายเงินให้ทนาย #l-payout-012', amount: -2975, type: 'payout', status: 'completed' },
    { id: 'txn4', date: '26 ก.ค. 2567', description: 'ค่าบริการเคส #case-002', amount: 5000, type: 'revenue', status: 'completed' },
    { id: 'txn5', date: '25 ก.ค. 2567', description: 'ส่วนแบ่งรายได้แพลตฟอร์ม #case-002', amount: 750, type: 'fee', status: 'completed' },
    { id: 'txn6', date: '25 ก.ค. 2567', description: 'จ่ายเงินให้ทนาย #l-payout-013', amount: -4250, type: 'payout', status: 'completed' },
    { id: 'txn7', date: '25 ก.ค. 2567', description: 'ค่าบริการเคส #case-003', amount: 8000, type: 'revenue', status: 'pending' },
    { id: 'txn8', date: '24 ก.ค. 2567', description: 'ค่าบริการเคส #case-004', amount: 2500, type: 'revenue', status: 'completed' },
    { id: 'txn9', date: '23 ก.ค. 2567', description: 'ส่วนแบ่งรายได้แพลตฟอร์ม #case-004', amount: 375, type: 'fee', status: 'completed' },
    { id: 'txn10', date: '23 ก.ค. 2567', description: 'จ่ายเงินให้ทนาย #l-payout-014', amount: -2125, type: 'payout', status: 'completed' },
    // June
    { id: 'txn11', date: '20 มิ.ย. 2567', description: 'ค่าบริการเคส #case-jun-01', amount: 12000, type: 'revenue', status: 'completed' },
    { id: 'txn12', date: '20 มิ.ย. 2567', description: 'ส่วนแบ่งรายได้แพลตฟอร์ม #case-jun-01', amount: 1800, type: 'fee', status: 'completed' },
    { id: 'txn13', date: '15 มิ.ย. 2567', description: 'ค่าบริการเคส #case-jun-02', amount: 4500, type: 'revenue', status: 'completed' },
    { id: 'txn14', date: '15 มิ.ย. 2567', description: 'ส่วนแบ่งรายได้แพลตฟอร์ม #case-jun-02', amount: 675, type: 'fee', status: 'completed' },
    // May
    { id: 'txn15', date: '18 พ.ค. 2567', description: 'ค่าบริการเคส #case-may-01', amount: 7000, type: 'revenue', status: 'completed' },
    { id: 'txn16', date: '18 พ.ค. 2567', description: 'ส่วนแบ่งรายได้แพลตฟอร์ม #case-may-01', amount: 1050, type: 'fee', status: 'completed' },
];

const thaiMonthMap: { [key: string]: number } = {
  'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5,
  'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11
};
const thaiMonthNames = Object.keys(thaiMonthMap);

const parseThaiDate = (thaiDate: string): Date => {
    const parts = thaiDate.split(' ');
    if (parts.length !== 3) return new Date(NaN);
    const day = parseInt(parts[0], 10);
    const month = thaiMonthMap[parts[1]];
    const year = parseInt(parts[2], 10) - 543;
    if (isNaN(day) || month === undefined || isNaN(year)) return new Date(NaN);
    return new Date(year, month, day);
};

export default function AdminFinancialsPage() {
    const defaultYear = getYear(new Date()).toString();
    const defaultMonth = getMonth(new Date()).toString();

    const [startYear, setStartYear] = useState<string>(defaultYear);
    const [startMonth, setStartMonth] = useState<string>(defaultMonth);
    const [endYear, setEndYear] = useState<string>(defaultYear);
    const [endMonth, setEndMonth] = useState<string>(defaultMonth);
    
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>(allTransactions);

    const availableMonths = useMemo(() => {
        const monthSet = new Set<string>();
        allTransactions.forEach(tx => {
            const date = parseThaiDate(tx.date);
            if (!isNaN(date.getTime())) {
                monthSet.add(`${getYear(date)}-${getMonth(date)}`);
            }
        });
        return Array.from(monthSet).map(my => {
            const [year, month] = my.split('-');
            return {
                value: my,
                label: `${thaiMonthNames[parseInt(month)]} ${parseInt(year) + 543}`
            };
        }).sort((a,b) => b.value.localeCompare(a.value)); // Sort descending
    }, []);

    const defaultMonthYear = `${defaultYear}-${defaultMonth}`;

    useEffect(() => {
        const [sYear, sMonth] = (startMonth || defaultMonthYear).split('-');
        const [eYear, eMonth] = (endMonth || defaultMonthYear).split('-');
        
        const startDate = startOfMonth(new Date(parseInt(sYear), parseInt(sMonth)));
        const endDate = endOfMonth(new Date(parseInt(eYear), parseInt(eMonth)));
        
        if (startDate > endDate) {
            setFilteredTransactions([]);
            return;
        }

        const filtered = allTransactions.filter(tx => {
            const txDate = parseThaiDate(tx.date);
            return isWithinInterval(txDate, { start: startDate, end: endDate });
        });
        setFilteredTransactions(filtered);
    }, [startMonth, endMonth, defaultMonthYear]);

  // Mock Data
  const totalServiceValue = 1259345;
  const platformRevenueThisMonth = 18802.50;
  const platformTotalRevenue = totalServiceValue * 0.15; // Assuming 15% platform fee
  
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
  
  const handleExport = () => {
    if (filteredTransactions.length === 0) return;
    
    const headers = ["ID", "Date", "Description", "Type", "Status", "Amount"];
    const csvRows = [
      headers.join(','),
      ...filteredTransactions.map(tx => 
        [tx.id, tx.date, `"${tx.description}"`, tx.type, tx.status, tx.amount].join(',')
      )
    ];
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `transactions-export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex-1">
                                <CardTitle>รายการธุรกรรมล่าสุด</CardTitle>
                                <CardDescription>แสดงธุรกรรมทั้งหมดตามช่วงเดือนที่เลือก</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Select value={startMonth || defaultMonthYear} onValueChange={setStartMonth}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="เลือกเดือนเริ่มต้น" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableMonths.map(month => (
                                            <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                 <span className="text-muted-foreground">-</span>
                                 <Select value={endMonth || defaultMonthYear} onValueChange={setEndMonth}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="เลือกเดือนสิ้นสุด" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableMonths.map(month => (
                                            <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" onClick={handleExport} disabled={filteredTransactions.length === 0}>
                                    <FileDown className="w-4 h-4 mr-2" />
                                    Export to Excel
                                </Button>
                            </div>
                        </div>
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
                                  {filteredTransactions.map(tx => (
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
                          {filteredTransactions.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                ไม่พบข้อมูลธุรกรรมสำหรับช่วงวันที่ที่เลือก
                            </div>
                          )}
                      </CardContent>
                      <CardFooter>
                          <div className="text-xs text-muted-foreground">
                            แสดง <strong>{filteredTransactions.length}</strong> รายการ
                          </div>
                      </CardFooter>
                  </Card>
              </CardContent>
          </Card>
      </main>
  );
}
