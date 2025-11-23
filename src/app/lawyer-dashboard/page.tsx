
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Briefcase, CheckCircle, Clock, DollarSign, FileText, Inbox, Percent, Star, User, Settings, BarChart, CalendarPlus, FileUp, Loader2 } from 'lucide-react';
import { getLawyerDashboardData } from '@/lib/data';
import type { LawyerCase, LawyerAppointmentRequest } from '@/lib/types';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
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
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useUser, useFirebase } from '@/firebase';

export default function LawyerDashboardPage() {
  const router = useRouter();
  const { auth, firestore } = useFirebase();
  const { data: user, isLoading: isUserLoading } = useUser(auth);

  const [requests, setRequests] = useState<LawyerAppointmentRequest[]>([]);
  const [activeCases, setActiveCases] = useState<LawyerCase[]>([]);
  const [completedCases, setCompletedCases] = useState<LawyerCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();


  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.push('/lawyer-login');
      return;
    }
    if (!firestore) return;
    
    async function fetchData() {
      setIsLoading(true);
      const data = await getLawyerDashboardData(firestore, user!.uid);
      setRequests(data.newRequests);
      setActiveCases(data.activeCases);
      setCompletedCases(data.completedCases);
      setIsLoading(false);
    }
    fetchData();
  }, [isUserLoading, user, router, firestore]);
  
  if (isUserLoading || isLoading || !user) {
      return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      )
  }

  const handleAcceptCase = (request: LawyerAppointmentRequest) => {
    const newChatId = uuidv4();
    toast({
      title: 'รับเคสสำเร็จ!',
      description: `เคส "${request.caseTitle}" ได้ถูกเพิ่มในรายการเคสที่กำลังดำเนินการ`,
    });
    router.push(`/chat/${newChatId}?lawyerId=1&clientId=...&view=lawyer`);
  };

  const incomeStat = { icon: <DollarSign className="w-10 h-10"/>, label: 'รายได้เดือนนี้', value: '฿75,000', color: 'text-green-500', href: '/admin/financials' };
  const otherStats = [
    { icon: <Star />, label: 'คะแนนเฉลี่ย', value: '4.8/5', color: 'text-yellow-500', href: '#' },
    { icon: <Percent />, label: 'อัตราการตอบรับ', value: '95%', color: 'text-blue-500', href: '#' },
    { icon: <Briefcase />, label: 'เคสที่เสร็จสิ้น', value: '12', color: 'text-purple-500', href: '#' },
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
                                <Button size="sm" variant="outline" asChild>
                                    <Link href={`/lawyer-dashboard/request/${req.id}`}>ดูรายละเอียด</Link>
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700">รับเคสนี้</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>ยืนยันการรับเคส?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                            การรับเคสนี้จะสร้างห้องสนทนาส่วนตัวระหว่างคุณและลูกค้า และจะถือว่าเป็นการเริ่มต้นการให้คำปรึกษาอย่างเป็นทางการ
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                            <AlertDialogAction
                                            onClick={() => handleAcceptCase(req)}
                                            className="bg-green-600 text-white hover:bg-green-700"
                                            >
                                            ยืนยันการรับเคส
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
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
                    <Link href={`/chat/${caseItem.id}?lawyerId=1&clientId=${caseItem.clientId}&view=lawyer`} key={caseItem.id}>
                        <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-200/50 transition-colors">
                            <div>
                                <p className="font-semibold">{caseItem.title}</p>
                                <p className="text-sm text-muted-foreground">ลูกค้า: {caseItem.clientName} | อัปเดตล่าสุด: {caseItem.lastUpdate}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {caseItem.notifications && (
                                  typeof caseItem.notifications === 'number' ? (
                                    <Badge variant="destructive" className="flex items-center justify-center w-6 h-6 rounded-full p-0">
                                      {caseItem.notifications}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="border-blue-500 bg-blue-50 text-blue-700">
                                      <FileUp className="w-3 h-3" />
                                    </Badge>
                                  )
                                )}
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
                    <Link href={`/chat/${caseItem.id}?lawyerId=1&clientId=${caseItem.clientId}&view=lawyer&status=closed`} key={caseItem.id}>
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
                  <AvatarImage src={user.photoURL || "https://images.unsplash.com/photo-1658250646172-227c363047af?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHxtYWxlJTIwbGF3eWVyfGVufDB8fHx8MTc2MzE5ODA0OXww&ixlib=rb-4.1.0&q=80&w=1080"} />
                  <AvatarFallback>{user.displayName?.charAt(0) || 'L'}</AvatarFallback>
                </Avatar>
                <p className="font-bold text-xl">{user.displayName}</p>
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
            
            <Card className="bg-green-600 text-white shadow-lg">
                <Link href={incomeStat.href} className="block p-6 hover:bg-green-700/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                           {incomeStat.icon}
                        </div>
                        <div>
                           <p className="text-sm font-light">{incomeStat.label}</p>
                           <p className="text-3xl font-bold">{incomeStat.value}</p>
                        </div>
                    </div>
                     <p className="text-center text-xs mt-4 bg-black/20 p-2 rounded-full">คลิกเพื่อดูรายละเอียด</p>
                </Link>
             </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="font-bold text-base">สถิติอื่นๆ</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2">
                    {otherStats.map(stat => (
                        <Link href={stat.href} key={stat.label} className="block p-2 bg-gray-100 rounded-lg text-center hover:bg-gray-200 hover:shadow-sm transition-all">
                            <div className={`mx-auto h-6 w-6 flex items-center justify-center ${stat.color}`}>{stat.icon}</div>
                            <p className="text-lg font-bold mt-1">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </Link>
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
