'use client';

import { useState, useEffect } from 'react';
import { Link } from '@/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Briefcase,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Inbox,
  Star,
  User,
  Settings,
  CalendarPlus,
  Loader2,
  ShieldX,
  AlertCircle,
  Sparkles,
  Scale,
  FileSearch,
  FolderLock,
  ChevronRight,
} from 'lucide-react';
import { getLawyerDashboardData, getLawyerStats } from '@/lib/data';
import { getMyLawyerProfileAction } from '@/app/actions/lawyer-directory-actions';
import type { LawyerCase, LawyerAppointmentRequest, LawyerProfile } from '@/lib/types';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import profileLawyerImg from '@/pic/profile-lawyer.jpg';
import { doc, getDoc } from 'firebase/firestore';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import LawyerSidebar from '@/components/layout/lawyer-sidebar';

export default function LawyerDashboardPage() {
  const router = useRouter();
  const { auth, firestore } = useFirebase();
  const { user, isUserLoading } = useUser();

  const [requests, setRequests] = useState<LawyerAppointmentRequest[]>([]);
  const [activeCases, setActiveCases] = useState<LawyerCase[]>([]);
  const [completedCases, setCompletedCases] = useState<LawyerCase[]>([]);
  const [stats, setStats] = useState({ incomeThisMonth: 0, totalIncome: 0, completedCases: 0, rating: 4.8, responseRate: 95 });
  const [lawyerProfile, setLawyerProfile] = useState<LawyerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Pricing state
  const [platformGPRate, setPlatformGPRate] = useState<number>(0.15); // Default 15%

  // Fetch platform GP rate
  useEffect(() => {
    if (!firestore) return;
    const fetchGPRate = async () => {
      try {
        const settingsDoc = await getDoc(doc(firestore, 'settings', 'platform'));
        if (settingsDoc.exists()) {
          setPlatformGPRate(settingsDoc.data().platformFeeRate || 0.15);
        }
      } catch (error) {
        console.error('Error fetching GP rate:', error);
      }
    };
    fetchGPRate();
  }, [firestore]);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.push('/lawyer-login');
      return;
    }
    if (!firestore) return;

    async function fetchData() {
      setIsLoading(true);
      try {
        const data = await getLawyerDashboardData(firestore!, user!.uid);
        const statsData = await getLawyerStats(firestore!, user!.uid);
        // โปรไฟล์ของตัวเองผ่าน server action (ผูกกับ session) — ไม่ยิง lawyerProfiles
        // จาก browser และรองรับโปรไฟล์ที่แอดมินสร้างซึ่ง doc id ไม่ใช่ uid
        const profile = await getMyLawyerProfileAction();

        setRequests(data.newRequests);
        setActiveCases(data.activeCases);
        setCompletedCases(data.completedCases);
        setStats(statsData);
        setLawyerProfile(profile || null);
      } catch (error) {
        console.error("Error fetching lawyer dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [isUserLoading, user, router, firestore, toast]);

  if (isUserLoading || isLoading || !user) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-[#002f4b]" />
      </div>
    );
  }

  const handleAcceptCase = (request: LawyerAppointmentRequest) => {
    const newChatId = uuidv4();
    toast({
      title: 'รับเคสสำเร็จ!',
      description: `เคส "${request.caseTitle}" ได้ถูกเพิ่มในรายการเคสที่กำลังดำเนินการ`,
    });
    router.push(`/chat/${newChatId}?lawyerId=${user.uid}&clientId=...&view=lawyer`);
  };

  const scheduleLink = '/lawyer-schedule';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <LawyerSidebar />

      <main className="flex-1 min-w-0 overflow-y-auto p-6 md:p-8 pt-20 md:pt-24 lg:pt-8 space-y-6">
        {/* Status Alerts */}
        {lawyerProfile?.status === 'suspended' && (
          <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 rounded-2xl">
            <ShieldX className="h-5 w-5" />
            <AlertTitle className="text-base font-bold">บัญชีของคุณถูกระงับ</AlertTitle>
            <AlertDescription className="text-xs">
              กรุณาติดต่อผู้ดูแลระบบเพื่อสอบถามข้อมูลเพิ่มเติม
            </AlertDescription>
          </Alert>
        )}

        {lawyerProfile?.status === 'pending' && (
          <Alert className="bg-yellow-50 border-yellow-200 text-yellow-800 rounded-2xl">
            <Clock className="h-5 w-5 text-yellow-600" />
            <AlertTitle className="text-base font-bold text-yellow-800">อยู่ระหว่างการตรวจสอบเอกสาร</AlertTitle>
            <AlertDescription className="text-xs text-yellow-700">
              เจ้าหน้าที่กำลังตรวจสอบใบอนุญาตทนายความของคุณ (ประมาณ 24-48 ชั่วโมง)
            </AlertDescription>
          </Alert>
        )}

        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#002f4b] dark:text-blue-400 flex items-center gap-2">
              แดชบอร์ดทนายความ
              <Badge variant="outline" className="text-[10px] uppercase font-bold bg-blue-50 text-blue-700 border-blue-200">
                Legal OS
              </Badge>
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              ยินดีต้อนรับคุณ <span className="font-semibold text-foreground">{lawyerProfile?.name || user.displayName || 'ทนายความ'}</span> &bull; ภาพรวมงานคดีและลูกความวันนี้
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/lawyer-dashboard/cases">
              <Button className="rounded-xl gap-2 text-white shadow-md" style={{ background: 'linear-gradient(135deg, #002f4b, #00466c)' }}>
                <Briefcase className="w-4 h-4" /> แฟ้มคดีทั้งหมด
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border shadow-sm p-4 bg-card/60">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold uppercase">คดีที่กำลังดำเนินการ</span>
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">{activeCases.length}</p>
            <p className="text-[11px] text-muted-foreground mt-1">คดีอยู่ในกระบวนการศาล</p>
          </Card>

          <Card className="rounded-2xl border shadow-sm p-4 bg-card/60">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold uppercase">รายได้เดือนนี้</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
              ฿{stats.incomeThisMonth.toLocaleString()}
            </p>
            <Link href="/lawyer-dashboard/financials" className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 mt-1">
              ดูรายละเอียดภาษี/ใบแจ้งหนี้ <ChevronRight className="w-3 h-3" />
            </Link>
          </Card>

          <Card className="rounded-2xl border shadow-sm p-4 bg-card/60">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold uppercase">คำขอปรึกษาใหม่</span>
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600">
                <Inbox className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">{requests.length}</p>
            <p className="text-[11px] text-muted-foreground mt-1">รอยืนยันรับเคส</p>
          </Card>

          <Card className="rounded-2xl border shadow-sm p-4 bg-card/60">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold uppercase">คะแนนประเมิน</span>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600">
                <Star className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">{lawyerProfile?.averageRating ? lawyerProfile.averageRating.toFixed(1) : stats.rating} / 5.0</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">ตอบรับ {stats.responseRate}%</p>
          </Card>
        </div>

        {/* AI Legal Copilot Banner */}
        <Card className="rounded-2xl border-none shadow-md overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #002f4b, #001f35)' }}>
          <CardContent className="p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold">AI Legal Copilot ผู้ช่วยทนายความ</h2>
                <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/30 text-[10px]">NEW</Badge>
              </div>
              <p className="text-xs text-white/80 max-w-xl leading-relaxed">
                ยกระดับการทำงานด้วยระบบสืบค้นข้อกฎหมาย & คำพิพากษาฎีกา Semantic Search และ AI ตรวจร่างสัญญาแม่นยำ
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 shrink-0">
              <Link href="/lawyer-dashboard/cases">
                <Button size="sm" className="rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-1.5 text-xs">
                  <Scale className="w-3.5 h-3.5 text-blue-300" /> แฟ้มสำนวนคดี
                </Button>
              </Link>
              <Link href="/lawyer-dashboard/vault">
                <Button size="sm" className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 text-xs font-bold shadow-md">
                  <FolderLock className="w-3.5 h-3.5" /> คลังเอกสาร SafeVault
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Main Grid: Left Requests & Cases, Right Profile & Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* New Requests */}
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-primary" />
                    คำขอนัดหมายปรึกษาใหม่ ({requests.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {requests.length > 0 ? (
                  <div className="space-y-3">
                    {requests.map((req) => (
                      <div key={req.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm text-foreground">{req.caseTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              ลูกความ: <span className="font-medium text-foreground">{req.clientName}</span> &bull; {format(req.requestedAt, 'dd MMM yyyy, HH:mm', { locale: th })}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs">
                                  รับเคสนี้
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>ยืนยันการรับเคส?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    การรับเคสนี้จะสร้างห้องสนทนาส่วนตัวระหว่างคุณและลูกความ
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleAcceptCase(req)}
                                    className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl"
                                  >
                                    ยืนยันการรับเคส
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        {req.description && (
                          <p className="text-xs text-muted-foreground bg-card p-2.5 rounded-lg border">
                            "{req.description}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Inbox className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="text-xs">ยังไม่มีคำขอปรึกษาใหม่ในขณะนี้</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Cases */}
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#002f4b] dark:text-blue-400" />
                  เคสที่กำลังดำเนินการ ({activeCases.length})
                </CardTitle>
                <Link href="/lawyer-dashboard/cases" className="text-xs font-semibold text-blue-600 hover:underline">
                  ดูทั้งหมด &rarr;
                </Link>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {activeCases.map((caseItem) => (
                  <Link
                    href={`/chat/${caseItem.id}?lawyerId=${user.uid}&clientId=${caseItem.clientId}&view=lawyer`}
                    key={caseItem.id}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors border">
                      <div className="space-y-0.5">
                        <p className="font-bold text-sm text-foreground">{caseItem.title}</p>
                        <p className="text-xs text-muted-foreground">ลูกความ: {caseItem.clientName} &bull; อัปเดต: {caseItem.lastUpdate}</p>
                      </div>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs shrink-0">
                        เข้าห้องคดี
                      </Button>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right 1 Col: Profile & Pricing */}
          <div className="space-y-6">
            {/* Profile Card */}
            <Card className="rounded-2xl border shadow-sm">
              <CardContent className="p-5 flex flex-col items-center text-center">
                <Avatar className="w-20 h-20 mb-3 border-2 border-primary/20">
                  <AvatarImage src={lawyerProfile?.imageUrl || user.photoURL || profileLawyerImg.src} />
                  <AvatarFallback>{user.displayName?.charAt(0) || 'L'}</AvatarFallback>
                </Avatar>
                <p className="font-bold text-base text-foreground">{lawyerProfile?.name || user.displayName}</p>
                <p className="text-xs text-muted-foreground">{lawyerProfile?.specialty || 'ทนายความผู้เชี่ยวชาญ'}</p>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] mt-2">
                  <CheckCircle className="w-3 h-3 mr-1" /> ยืนยันตัวตนทนายความแล้ว
                </Badge>

                <div className="grid grid-cols-2 gap-2 w-full mt-4">
                  <Link href={scheduleLink} className="w-full">
                    <Button variant="outline" size="sm" className="w-full rounded-xl text-xs">
                      <CalendarPlus className="w-3.5 h-3.5 mr-1" /> ตารางนัด
                    </Button>
                  </Link>
                  <Link href="/lawyer-dashboard/vault" className="w-full">
                    <Button variant="outline" size="sm" className="w-full rounded-xl text-xs">
                      <FolderLock className="w-3.5 h-3.5 mr-1" /> คลังเอกสาร
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
}
