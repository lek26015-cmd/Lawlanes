'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Briefcase, CheckCircle, Clock, DollarSign, FileText, Inbox, Percent, Star, User, Settings, BarChart, CalendarPlus, FileUp, Loader2, ShieldX, AlertCircle, LogOut, Wallet, ChevronDown, ChevronUp, Plus, Bell } from 'lucide-react';
import { cn } from "@/lib/utils";
import { 
  getLawyerStatsAction, 
  getLawyerDashboardDataAction, 
  getAdminLawyerDashboardDataAction 
} from '@/app/actions/dashboard-actions';
import { 
  getLawyerProfileAction, 
  getUserRoleAction 
} from '@/app/actions/lawyer-actions';
import type { LawyerCase, LawyerAppointmentRequest, LawyerProfile } from '@/lib/types';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import profileLawyerImg from '@/pic/profile-lawyer.jpg';
import { LayoutDashboard } from 'lucide-react';
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
import { signOut } from 'firebase/auth';

import { getLawyerLegalCases } from '@/app/actions/lawyer-case-actions';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Case as LegalCase } from '@/lib/types/billing-types';
import { ChatListItem } from '@/components/dashboard/chat-list-item';

export default function LawyerDashboardPage() {
  const router = useRouter();
  const { auth, firestore } = useFirebase();
  const { user, isUserLoading } = useUser();

  const [requests, setRequests] = useState<LawyerAppointmentRequest[]>([]);
  const [activeCases, setActiveCases] = useState<LawyerCase[]>([]);
  const [completedCases, setCompletedCases] = useState<LawyerCase[]>([]);
  const [legalCases, setLegalCases] = useState<LegalCase[]>([]);
  const [stats, setStats] = useState({ incomeThisMonth: 0, totalIncome: 0, completedCases: 0, rating: 4.8, responseRate: 95 });
  const [lawyerProfile, setLawyerProfile] = useState<LawyerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isChatSectionOpen, setIsChatSectionOpen] = useState(true);
  const [showAllCompleted, setShowAllCompleted] = useState(false);



  const handleLogout = async () => {
    if (auth) {
      try {
        await fetch('/api/auth/session', { method: 'DELETE' });
      } catch (err) {
        console.error("Failed to clear session cookie:", err);
      }
      await signOut(auth);
      toast({
        title: "ออกจากระบบแล้ว!",
        description: "คุณได้ออกจากระบบเรียบร้อยแล้ว",
      });
      window.location.href = '/';
    }
  };

  const fetchData = useCallback(async (isInitial = true) => {
    if (isInitial) setIsLoading(true);
    try {
      if (!user) return;
      // Check if user is admin
      const userRole = await getUserRoleAction(user.uid);
      const isAdmin = userRole === 'admin';

      // Use system-wide overview for admins, personal data for lawyers
      const [data, statsData, profile, fetchedLegalCases] = await Promise.all([
        isAdmin ? getAdminLawyerDashboardDataAction() : getLawyerDashboardDataAction(user.uid),
        getLawyerStatsAction(user.uid),
        getLawyerProfileAction(user.uid),
        getLawyerLegalCases(user.uid)
      ]);

      if (isAdmin && !profile) {
        // If admin doesn't have a lawyer profile, set a default one for display
        setLawyerProfile({
          id: user.uid,
          userId: user.uid,
          name: user.displayName || 'Administrator',
          email: user.email || '',
          phone: '',
          licenseNumber: 'ADMIN',
          status: 'approved',
          imageUrl: user.photoURL || '',
          dob: new Date(),
          gender: 'อื่นๆ',
          address: 'Headquarters',
          description: 'System Administrator',
          education: '',
          experience: '',
          bankName: '',
          bankAccountName: '',
          bankAccountNumber: '',
          serviceProvinces: ['All'],
          specialty: ['System Admin'],
          imageHint: '',
          idCardUrl: '',
          lawyerLicenseUrl: '',
          createdAt: new Date(),
          licenseUrl: '',
          joinedAt: new Date().toISOString(),
        } as LawyerProfile);
      } else {
        setLawyerProfile(profile || null);
      }

      setRequests(data.newRequests);
      setActiveCases(data.activeCases);
      setCompletedCases(data.completedCases);
      setStats(statsData);
      if (fetchedLegalCases) setLegalCases(fetchedLegalCases);
    } catch (error) {
      console.error("Error fetching lawyer dashboard data:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.push('/lawyer-login');
      return;
    }
    fetchData(true);
  }, [isUserLoading, user, router, fetchData]);

  // Real-time listener for chats to update unread counts and last messages
  useEffect(() => {
    if (isUserLoading || !user || !firestore) return;

    const q = query(
      collection(firestore, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    let isFirstRun = true;
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      
      // If something changed in chats, refresh the dashboard data
      // We check for metadata.hasPendingWrites to avoid refreshing on our own local updates if any
      if (!snapshot.metadata.hasPendingWrites) {
        fetchData(false); // Silent refresh
        
        // Play notification sound if a new message is detected
        // (This is a bit crude but effective: if any doc in the snapshot has lawyerReadStatus === 'unread')
        const hasUnread = snapshot.docs.some((doc: any) => {
          const data = doc.data();
          return data.lawyerReadStatus === 'unread' && data.lastMessageAt?.toMillis() > (Date.now() - 5000);
        });

        if (hasUnread) {
          const audio = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZWY1OC43Ni4xMDABABAAAAAAAAAA/+NAAAAAAAAAAAAAAAAAAAAAAABYaW5nAAAADwAAABIAAA7sAAICAgICAgICAgMDAwMDAwMDDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwLC8vdHh0AExhdmVjNTguNzYAL7Ois6KzoqKioqKis6KzAAD/40AAAsXzB6p9AEUAAAABpAAAAn9Y+Z/Wvmf1P6n9Y+Z/U/qf1j5n9T+p/Wvmf1P6n9Y+S60AsXzBt1pBFAAAAApAAAAn9Y+S60At60AsXzBt1ZBLAAAAApAAAAn9Y+S60At60AsXzBt1pBLAACAAD/40AAAsXzBt1pBLAAAAApAAAAtXzBt1ZBLAAGAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVs=");
          audio.volume = 0.4;
          audio.play().catch(() => {});
        }
      }
    });

    return () => unsubscribe();
  }, [isUserLoading, user, firestore, fetchData]);

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
    router.push(`/chat/${newChatId}?lawyerId=${user.uid}&clientId=${request.userId}&view=lawyer`);
  };

  const isMockAdmin = lawyerProfile?.licenseNumber === 'ADMIN';
  const scheduleLink = isMockAdmin ? '/lawyer-schedule?view=admin' : '/lawyer-schedule';
  const incomeStat = {
    icon: <DollarSign className="w-10 h-10" />,
    label: 'รายได้เดือนนี้',
    value: `฿${stats.incomeThisMonth.toLocaleString()}`,
    color: 'text-green-500',
    href: isMockAdmin ? '/lawyer-dashboard/financials?view=admin' : '/lawyer-dashboard/financials'
  };
  const otherStats = [
    { icon: <Star />, label: 'คะแนนเฉลี่ย', value: `${lawyerProfile?.averageRating ? lawyerProfile.averageRating.toFixed(1) : stats.rating}/5`, color: 'text-yellow-500', href: '#' },
    { icon: <Percent />, label: 'อัตราการตอบรับ', value: `${stats.responseRate}%`, color: 'text-blue-500', href: '#' },
    { icon: <Briefcase />, label: 'เคสที่เสร็จสิ้น', value: `${stats.completedCases}`, color: 'text-purple-500', href: '#' },
  ];

  return (
    <div className="bg-gray-100/50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">

        {/* Status Alerts */}
        {lawyerProfile?.status === 'suspended' && (
          <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800 rounded-3xl">
            <ShieldX className="h-5 w-5" />
            <AlertTitle className="text-lg font-bold">บัญชีของคุณถูกระงับ</AlertTitle>
            <AlertDescription>
              กรุณาติดต่อผู้ดูแลระบบเพื่อสอบถามข้อมูลเพิ่มเติม หากคุณเชื่อว่านี่เป็นข้อผิดพลาด
            </AlertDescription>
          </Alert>
        )}

        {lawyerProfile?.status === 'rejected' && (
          <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800 rounded-3xl">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-bold">การสมัครของคุณไม่ผ่านการอนุมัติ</AlertTitle>
            <AlertDescription className="mt-2 text-sm leading-relaxed">
              <strong>เหตุผล:</strong> {lawyerProfile.rejectionReason || 'เอกสารไม่ครบถ้วนหรือไม่ถูกต้อง'}
              <br />
              กรุณาตรวจสอบเอกสารและทำการสมัครใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่
            </AlertDescription>
          </Alert>
        )}

        {lawyerProfile?.status === 'pending' && (
          <Alert className="mb-6 bg-yellow-50 border-yellow-200 text-yellow-800 rounded-3xl">
            <Clock className="h-5 w-5 text-yellow-600" />
            <AlertTitle className="text-lg font-bold text-yellow-800">อยู่ระหว่างการตรวจสอบ</AlertTitle>
            <AlertDescription className="text-yellow-700">
              เจ้าหน้าที่ได้รับข้อมูลของคุณแล้ว และกำลังอยู่ในขั้นตอนการตรวจสอบเอกสาร (ใช้เวลาประมาณ 24-48 ชั่วโมง)
              <br />คุณจะได้รับอีเมลแจ้งผลการอนุมัติเมื่อดำเนินการเสร็จสิ้น
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-headline">แดชบอร์ดทนายความ</h1>
            <p className="text-muted-foreground">ภาพรวมการทำงานและจัดการเคสของคุณ</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const audio = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZWY1OC43Ni4xMDABABAAAAAAAAAA/+NAAAAAAAAAAAAAAAAAAAAAAABYaW5nAAAADwAAABIAAA7sAAICAgICAgICAgMDAwMDAwMDDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwLC8vdHh0AExhdmVjNTguNzYAL7Ois6KzoqKioqKis6KzAAD/40AAAsXzB6p9AEUAAAABpAAAAn9Y+Z/Wvmf1P6n9Y+Z/U/qf1j5n9T+p/Wvmf1P6n9Y+S60AsXzBt1pBFAAAAApAAAAn9Y+S60At60AsXzBt1ZBLAAAAApAAAAn9Y+S60At60AsXzBt1pBLAACAAD/40AAAsXzBt1pBLAAAAApAAAAtXzBt1ZBLAAGAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVpBLAAIAAAsXzBtVs=");
              audio.volume = 0.5;
              audio.play().catch(e => console.error("Audio play failed:", e));
            }}
            className="w-full md:w-auto gap-2 border-primary/20 hover:border-primary/50 text-primary rounded-full bg-white shadow-sm"
          >
            <Bell className="h-4 w-4" />
            ทดสอบเสียงแจ้งเตือน (กระดิ่ง)
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">


            {/* Chat Consultations (Combined Active and Completed) */}
            <Collapsible
              open={isChatSectionOpen}
              onOpenChange={setIsChatSectionOpen}
              className="w-full"
            >
              <Card className="rounded-3xl shadow-sm border-none overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <Inbox className="w-5 h-5 text-primary" />
                    <CardTitle className="font-bold">แชทปรึกษา</CardTitle>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-9 p-0 rounded-full">
                      {isChatSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <span className="sr-only">Toggle</span>
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    {/* Active Chats */}
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-muted-foreground px-4 py-2 uppercase tracking-wider flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-green-500" />
                        กำลังดำเนินการ ({activeCases.length})
                      </p>
                      <div className="space-y-3 px-1">
                        {activeCases.map((caseItem) => (
                          <ChatListItem
                            key={caseItem.id}
                            id={caseItem.id}
                            name={caseItem.clientName}
                            imageUrl={caseItem.clientImageUrl}
                            lastMessage={caseItem.lastMessage}
                            updatedAt={caseItem.updatedAt}
                            unreadCount={typeof caseItem.notifications === 'number' ? caseItem.notifications : 0}
                            status={caseItem.isWaitingVerification ? 'pending_verification' : caseItem.status}
                            type={caseItem.isOfficial ? 'case' : 'preliminary'}
                            href={`/chat/${caseItem.id}?lawyerId=${user.uid}&clientId=${caseItem.clientId}&view=lawyer`}
                            isLawyerView={true}
                            isOnline={caseItem.isOnline}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-gray-100 my-2" />

                    {/* Completed Chats */}
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-muted-foreground px-4 py-2 uppercase tracking-wider">เสร็จสิ้นแล้ว ({completedCases.length})</p>
                      <div className="space-y-3 px-1">
                        {(showAllCompleted ? completedCases : completedCases.slice(0, 3)).map((caseItem) => (
                          <ChatListItem
                            key={caseItem.id}
                            id={caseItem.id}
                            name={caseItem.clientName}
                            imageUrl={caseItem.clientImageUrl}
                            lastMessage={caseItem.lastMessage}
                            updatedAt={caseItem.updatedAt}
                            unreadCount={0}
                            status={caseItem.status}
                            type={caseItem.isOfficial ? 'case' : 'preliminary'}
                            href={`/chat/${caseItem.id}?lawyerId=${user.uid}&clientId=${caseItem.clientId}&view=lawyer&status=closed`}
                            isLawyerView={true}
                            className="opacity-70 grayscale-[0.5]"
                            isOnline={caseItem.isOnline}
                          />
                        ))}
                      </div>
                      
                      {!showAllCompleted && completedCases.length > 3 && (
                        <Button 
                          variant="ghost" 
                          className="w-full mt-2 text-primary hover:text-primary hover:bg-primary/5 rounded-2xl"
                          onClick={() => setShowAllCompleted(true)}
                        >
                          ดูทั้งหมด ({completedCases.length})
                        </Button>
                      )}
                      
                      {showAllCompleted && completedCases.length > 3 && (
                        <Button 
                          variant="ghost" 
                          className="w-full mt-2 text-muted-foreground hover:bg-gray-100 rounded-2xl"
                          onClick={() => setShowAllCompleted(false)}
                        >
                          ย่อลง
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>



          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-3xl shadow-sm border-none">
              <CardContent className="pt-6 flex flex-col items-center text-center">
                <Avatar className="w-24 h-24 mb-4">
                  <AvatarImage src={lawyerProfile?.imageUrl || user.photoURL || profileLawyerImg.src} />
                  <AvatarFallback>{user.displayName?.charAt(0) || 'L'}</AvatarFallback>
                </Avatar>
                <p className="font-bold text-xl">{lawyerProfile?.name || user.displayName}</p>
                <p className="text-sm text-muted-foreground">{lawyerProfile?.specialty || 'ทนายความ'}</p>
                <div className="mt-2">
                  {lawyerProfile?.status === 'approved' && (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                      <CheckCircle className="w-3 h-3 mr-1" /> ยืนยันตัวตนแล้ว
                    </Badge>
                  )}
                  {lawyerProfile?.status === 'pending' && (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600 bg-yellow-50">
                      <Clock className="w-3 h-3 mr-1" /> รอการตรวจสอบ
                    </Badge>
                  )}
                  {lawyerProfile?.status === 'rejected' && (
                    <Badge variant="destructive">
                      <CheckCircle className="w-3 h-3 mr-1 rotate-45" /> ไม่ผ่านการอนุมัติ
                    </Badge>
                  )}
                  {lawyerProfile?.status === 'suspended' && (
                    <Badge variant="destructive">
                      <ShieldX className="w-3 h-3 mr-1" /> ถูกระงับบัญชี
                    </Badge>
                  )}
                </div>
                <div className="flex mt-4 gap-2">
                  {isMockAdmin ? (
                    <Button variant="outline" className="rounded-full opacity-50 cursor-not-allowed" disabled><User className="mr-2" /> โปรไฟล์สาธารณะ</Button>
                  ) : (
                    <Link href={user.uid ? `/lawyers/${user.uid}` : '#'} passHref>
                      <Button variant="outline" className="rounded-full"><User className="mr-2" /> โปรไฟล์สาธารณะ</Button>
                    </Link>
                  )}
                  <Link href={scheduleLink} passHref>
                    <Button variant="outline" className="rounded-full"><Settings className="mr-2" /> จัดการตาราง</Button>
                  </Link>
                </div>
                <Button
                  variant="destructive"
                  className="w-full mt-6 rounded-full"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 w-4 h-4" /> ออกจากระบบ
                </Button>
              </CardContent>
            </Card>


            <Card className="bg-green-600 text-white shadow-lg rounded-3xl border-none">
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

            <Card className="rounded-3xl shadow-sm border-none">
              <CardHeader>
                <CardTitle className="font-bold text-base">สถิติ</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-2">
                {otherStats.map(stat => (
                  <Link href={stat.href} key={stat.label} className="block p-2 bg-gray-100 rounded-3xl text-center hover:bg-gray-200 hover:shadow-sm transition-all">
                    <div className={`mx-auto h-6 w-6 flex items-center justify-center ${stat.color}`}>{stat.icon}</div>
                    <p className="text-lg font-bold mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-sm border-none">
              <CardHeader>
                <CardTitle className="font-bold">เครื่องมือ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/lawyer-dashboard/pipeline" passHref>
                  <Button variant="ghost" className="w-full justify-start rounded-full">
                    <Briefcase className="mr-2 w-4 h-4" /> จัดการเคส (Pipeline)
                  </Button>
                </Link>
                <Link href="/lawyer-dashboard/billing" passHref>
                  <Button variant="ghost" className="w-full justify-start rounded-full">
                    <Wallet className="mr-2 w-4 h-4" /> การเงินและใบแจ้งหนี้ (Billing)
                  </Button>
                </Link>
                <Link href={scheduleLink} passHref>
                  <Button variant="ghost" className="w-full justify-start rounded-full"><CalendarPlus className="mr-2 w-4 h-4" /> จัดการตารางนัดหมาย</Button>
                </Link>
                <Link href={incomeStat.href} passHref>
                  <Button variant="ghost" className="w-full justify-start rounded-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"><BarChart className="mr-2 w-4 h-4" /> ดูรายงานสรุป</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
