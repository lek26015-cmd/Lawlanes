
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Briefcase, CheckCircle, Clock, DollarSign, FileText, Inbox, Percent, Star, User, Settings, BarChart, CalendarPlus } from 'lucide-react';
import { getLawyerDashboardData } from '@/lib/data';
import type { LawyerCase, LawyerAppointmentRequest } from '@/lib/types';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export default function LawyerDashboardPage() {
  const [requests, setRequests] = useState<LawyerAppointmentRequest[]>([]);
  const [activeCases, setActiveCases] = useState<LawyerCase[]>([]);
  const [completedCases, setCompletedCases] = useState<LawyerCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const data = await getLawyerDashboardData();
      setRequests(data.newRequests);
      setActiveCases(data.activeCases);
      setCompletedCases(data.completedCases);
      setIsLoading(false);
    }
    fetchData();
  }, []);

  const stats = [
    { icon: <DollarSign />, label: 'รายได้เดือนนี้', value: '฿75,000', color: 'text-green-500' },
    { icon: <Star />, label: 'คะแนนเฉลี่ย', value: '4.8/5', color: 'text-yellow-500' },
    { icon: <Percent />, label: 'อัตราการตอบรับ', value: '95%', color: 'text-blue-500' },
    { icon: <Briefcase />, label: 'เคสที่เสร็จสิ้น', value: '12', color: 'text-purple-500' },
  ];
  
  const caseStatusBadge = {
    'รอการตอบรับ': <Badge variant="destructive">ใหม่</Badge>,
    'กำลังดำเนินการ': <Badge variant="secondary">กำลังดำเนินการ</Badge>,
    'เสร็จสิ้น': <Badge className="bg-green-100 text-green-800">เสร็จสิ้น</Badge>,
  };


  return (
    <div className="bg-gray-100/50 min-h-screen">
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold font-headline">แดชบอร์ดทนายความ</h1>
          <p className="text-muted-foreground">ภาพรวมการทำงานและจัดการเคสของคุณ</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* New Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold">
                  <Inbox className="w-5 h-5 text-primary" />
                  คำขอปรึกษาใหม่ ({requests.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {requests.length > 0 ? (
                  <div className="space-y-4">
                    {requests.map((req) => (
                      <div key={req.id} className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex flex-col sm:flex-row justify-between">
                            <div>
                                <p className="font-semibold text-foreground">{req.caseTitle}</p>
                                <p className="text-sm text-muted-foreground">
                                    ผู้ขอ: {req.clientName} | ขอเมื่อ: {format(req.requestedAt, 'dd MMM yyyy, HH:mm', { locale: th })}
                                </p>
                            </div>
                            <div className="flex gap-2 mt-3 sm:mt-0">
                                <Button size="sm" variant="outline">ดูรายละเอียด</Button>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700">รับเคสนี้</Button>
                            </div>
                        </div>
                        <Card className="mt-3 bg-background/50 p-3">
                           <p className="text-sm text-muted-foreground">"{req.description}"</p>
                        </Card>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Inbox className="mx-auto h-10 w-10 mb-2" />
                    <p>ยังไม่มีคำขอใหม่</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Cases */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold">
                  <Briefcase className="w-5 h-5" />
                  เคสที่กำลังดำเนินการ
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeCases.map((caseItem) => (
                    <Link href={`/chat/${caseItem.id}?lawyerId=1`} key={caseItem.id}>
                        <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-200/50 transition-colors">
                            <div>
                                <p className="font-semibold">{caseItem.title}</p>
                                <p className="text-sm text-muted-foreground">ลูกค้า: {caseItem.clientName} | อัปเดตล่าสุด: {caseItem.lastUpdate}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {caseItem.hasNewMessage && <Badge variant="destructive">ข้อความใหม่</Badge>}
                                <Button size="sm">เข้าสู่ห้องแชท</Button>
                            </div>
                        </div>
                    </Link>
                ))}
              </CardContent>
            </Card>
            
            {/* Completed Cases */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  เคสที่เสร็จสิ้นแล้ว
                </CardTitle>
              </CardHeader>
               <CardContent>
                {completedCases.map((caseItem) => (
                    <Link href={`/chat/${caseItem.id}?lawyerId=1&status=closed`} key={caseItem.id}>
                        <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-200/50 transition-colors">
                            <div>
                                <p className="font-semibold">{caseItem.title}</p>
                                <p className="text-sm text-muted-foreground">ลูกค้า: {caseItem.clientName} | วันที่เสร็จสิ้น: {caseItem.lastUpdate}</p>
                            </div>
                            <Badge variant="outline">ดูประวัติ</Badge>
                        </div>
                    </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center text-center">
                <Avatar className="w-24 h-24 mb-4">
                  <AvatarImage src="https://images.unsplash.com/photo-1658250646172-227c363047af?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHxtYWxlJTIwbGF3eWVyfGVufDB8fHx8MTc2MzE5ODA0OXww&ixlib=rb-4.1.0&q=80&w=1080" />
                  <AvatarFallback>สช</AvatarFallback>
                </Avatar>
                <p className="font-bold text-xl">นายสมชาย กฎหมายดี</p>
                <p className="text-sm text-muted-foreground">SME Fraud Expert</p>
                 <div className="flex mt-4 gap-2">
                    <Link href="/lawyer-profile/edit" passHref>
                        <Button variant="outline"><User className="mr-2"/> โปรไฟล์</Button>
                    </Link>
                    <Link href="/lawyer-settings" passHref>
                        <Button variant="outline"><Settings className="mr-2"/> ตั้งค่า</Button>
                    </Link>
                </div>
              </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="font-bold">สถิติภาพรวม</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    {stats.map(stat => (
                        <div key={stat.label} className="p-3 bg-gray-100 rounded-lg text-center">
                            <div className={`mx-auto h-8 w-8 flex items-center justify-center ${stat.color}`}>{stat.icon}</div>
                            <p className="text-xl font-bold mt-1">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                    ))}
                </CardContent>
             </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="font-bold">เครื่องมือ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Link href="/lawyer-schedule" passHref>
                        <Button variant="ghost" className="w-full justify-start"><CalendarPlus className="mr-2"/> จัดการตารางนัดหมาย</Button>
                    </Link>
                    <Button variant="ghost" className="w-full justify-start"><BarChart className="mr-2"/> ดูรายงานสรุป</Button>
                </CardContent>
             </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
