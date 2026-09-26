
'use client';

import LawyerPageHeader, { LawyerPageLoading } from '@/components/lawyer/lawyer-page-header';

import { useState, useEffect, Suspense } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getLawyerAppointmentRequestById } from '@/lib/data';
import type { LawyerAppointmentRequest } from '@/lib/types';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  FileText,
  Check,
  X,
  Loader2,
  DollarSign, Inbox } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { useFirebase } from '@/firebase';
import { respondToAppointmentRequestAction } from '@/app/actions/lawyer-actions';
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


function RequestDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const { firestore } = useFirebase();
  const [request, setRequest] = useState<LawyerAppointmentRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRequestData() {
      if (!firestore) return;
      setIsLoading(true);
      const requestData = await getLawyerAppointmentRequestById(firestore, id);

      if (!requestData) {
        notFound();
        return;
      }
      setRequest(requestData);
      setIsLoading(false);
    }
    fetchRequestData();
  }, [id, firestore]);

  // การรับเคสสร้างห้องแชทใหม่ ซึ่งเดิมทำด้วย addDoc ฝั่ง client (ต้องพึ่งกฎ
  // `chats: allow create: if isSignedIn()` ที่เปิดให้ใครก็สร้างเคสพร้อมยอดเองได้)
  // ย้ายไป server action แล้ว — ดู respondToAppointmentRequestAction()
  const handleAcceptCase = async () => {
    if (!request) return;

    try {
      const result = await respondToAppointmentRequestAction({ appointmentId: id, decision: 'accept' });
      if (!result.ok) {
        toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: result.error });
        return;
      }

      toast({
        title: 'รับเคสสำเร็จ!',
        description: `เคส "${request.caseTitle}" ได้ถูกเพิ่มในรายการเคสที่กำลังดำเนินการ`,
      });

      router.push(`/chat/${result.chatId}`);
    } catch (error) {
      console.error("Error accepting case:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถรับเคสได้ กรุณาลองใหม่อีกครั้ง"
      });
    }
  };

  const handleRejectCase = async () => {
    if (!request) return;

    try {
      const result = await respondToAppointmentRequestAction({ appointmentId: id, decision: 'reject' });
      if (!result.ok) {
        toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: result.error });
        return;
      }

      toast({
        title: 'ปฏิเสธเคสสำเร็จ',
        description: `คุณได้ปฏิเสธคำขอปรึกษาจาก ${request.clientName}`,
        variant: 'destructive' // Keep destructive for visual feedback of rejection
      });
      router.push('/lawyer-dashboard');
    } catch (error) {
      console.error("Error rejecting case:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถปฏิเสธเคสได้"
      });
    }
  };

  if (isLoading) {
    return (
      <LawyerPageLoading />
    );
  }

  if (!request) {
    return notFound();
  }

  return (
    <div className="max-w-3xl space-y-6">
        <LawyerPageHeader
          icon={Inbox}
          title="คำขอปรึกษา"
          description="ตรวจสอบรายละเอียดและตัดสินใจรับเคส"
          back={{ href: '/lawyer-dashboard', label: 'ภาพรวม' }}
        />

        <Card className="rounded-2xl border shadow-sm overflow-hidden">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-4 rounded-lg border bg-secondary/30 p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback>{request.clientName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-muted-foreground">ผู้ขอรับคำปรึกษา</p>
                  <p className="font-bold text-lg text-foreground">{request.clientName}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border bg-background p-4">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-muted-foreground" /> ข้อมูลเคส</h3>
              <div className="flex items-start gap-3 pl-7">
                <div>
                  <p className="font-medium">หัวข้อ</p>
                  <p className="text-muted-foreground">{request.caseTitle}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 pl-7">
                <div>
                  <p className="font-medium">รายละเอียดปัญหา</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {request.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border bg-background p-4">
              <h3 className="font-semibold flex items-center gap-2"><Clock className="w-5 h-5 text-muted-foreground" /> ข้อมูลการส่งเรื่อง</h3>
              <div className="flex items-start gap-3 pl-7">
                <div>
                  <p className="font-medium">วันที่ส่งคำขอ</p>
                  <p className="text-muted-foreground">
                    {format(request.requestedAt, 'EEEE, d MMMM yyyy, HH:mm', { locale: th })}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-4">
              <h3 className="font-semibold flex items-center gap-2 text-green-800"><DollarSign className="w-5 h-5" /> ค่าบริการ (Escrow)</h3>
              <div className="flex items-center justify-between text-green-700 pl-7">
                <p>ลูกความได้ชำระค่าบริการเบื้องต้นไว้ในระบบแล้ว</p>
                <p className="font-bold text-lg">฿3,500</p>
              </div>
            </div>


          </CardContent>
          <CardFooter className="flex flex-col gap-3 bg-gray-50 p-6 sm:flex-row sm:justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="lg">
                  <X className="mr-2" /> ปฏิเสธเคส
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>คุณแน่ใจหรือไม่ที่จะปฏิเสธเคสนี้?</AlertDialogTitle>
                  <AlertDialogDescription>
                    การกระทำนี้จะแจ้งให้ผู้ขอรับคำปรึกษาทราบว่าคุณไม่สะดวกรับเคสนี้ และพวกเขาจะต้องหาทนายความท่านอื่นต่อไป
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRejectCase}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    ยืนยันการปฏิเสธ
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="lg" className="bg-green-600 hover:bg-green-700">
                  <Check className="mr-2" /> รับเคสนี้
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ยืนยันการรับเคส?</AlertDialogTitle>
                  <AlertDialogDescription>
                    การรับเคสนี้จะสร้างห้องสนทนาส่วนตัวระหว่างคุณและลูกความ และจะถือว่าเป็นการเริ่มต้นการให้คำปรึกษาอย่างเป็นทางการ
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleAcceptCase}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    ยืนยันการรับเคส
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
    </div>
  );
}

export default function RequestDetailPage() {
  return (
    <Suspense fallback={<div>Loading request...</div>}>
      <RequestDetailPageContent />
    </Suspense>
  )
}
