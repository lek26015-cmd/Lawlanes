
'use client'

import { useState, useEffect } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getPublicLawyerAction, type PublicLawyer } from '@/app/actions/lawyer-directory-actions';
import type { LawyerProfile } from '@/lib/types';
import { ArrowLeft, Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { addDays, format } from 'date-fns';
import { useFirebase } from '@/firebase';
import { requestAppointmentAction } from '@/app/actions/appointment-actions';

export default function SchedulePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { toast } = useToast();
  const { firestore, user } = useFirebase();

  const [lawyer, setLawyer] = useState<PublicLawyer | null>(null);
  const [date, setDate] = useState<Date | undefined>();
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchLawyer() {
      if (!id || !firestore) return;
      setIsLoading(true);
      // โปรไฟล์สาธารณะ (รวมตารางเวลาแบบไม่มีเหตุผลวันหยุด) ผ่าน server action
      const lawyerData = await getPublicLawyerAction(id);
      if (!lawyerData) {
        notFound();
      }
      setLawyer(lawyerData);
      setIsLoading(false);
    }
    fetchLawyer();
  }, [id, firestore]);

  // เดิมส่งต่อไปหน้า /payment เพื่อจ่ายค่านัด ฿3,500 เข้าบัญชีแพลตฟอร์มก่อนถึงจะเกิดคำขอ
  // ตอนนี้ขอนัดฟรี: สร้างคำขอ status 'pending' ผ่าน server action แล้วรอทนายตอบรับ
  // ค่าบริการ (ถ้ามี) ทนายเสนอในแชทหลังรับเคส และลูกความจ่ายทนายโดยตรง
  const handleSubmit = async () => {
    if (!date || !description.trim()) {
      toast({
        variant: "destructive",
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณาเลือกวันที่และกรอกรายละเอียดการปรึกษา",
      });
      return;
    }
    if (!user) {
      router.push('/login');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestAppointmentAction({
        lawyerId: id,
        appointmentDate: date.toISOString(),
        description,
      });
      if (!res.ok) {
        toast({ variant: "destructive", title: "ส่งคำขอไม่สำเร็จ", description: res.error });
        return;
      }
      toast({ title: "ส่งคำขอนัดหมายแล้ว", description: "ทนายจะตอบรับคำขอของคุณเร็วๆ นี้" });
      router.push('/dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div>Loading...</div>
        </div>
      );
  }

  if (!lawyer) {
    return notFound();
  }

  // เดิมหน้านี้ปล่อยให้จองวันไหนก็ได้ในช่วง 60 วัน ไม่เคยเช็คตารางเวลาจริงของทนายเลย
  // ตอนนี้ทนายบันทึกวันทำการ/วันหยุดจริงผ่าน lawyer-schedule แล้ว (lawyerProfiles.schedule)
  // ให้ปฏิทินฝั่งลูกความปิดวันที่ทนายไม่รับนัดตามข้อมูลจริงแทน
  const DAY_KEYS: (keyof NonNullable<LawyerProfile['schedule']>['availableDays'])[] =
    ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  const isDateUnavailable = (day: Date) => {
    if (day < new Date(new Date().setHours(0, 0, 0, 0)) || day > addDays(new Date(), 60)) return true;

    const schedule = lawyer.schedule;
    if (!schedule) return false; // ทนายยังไม่ได้ตั้งตารางเวลา — ใช้พฤติกรรมเดิม (เปิดทุกวันในช่วง 60 วัน)

    const dayKey = DAY_KEYS[day.getDay()];
    if (schedule.availableDays && schedule.availableDays[dayKey] === false) return true;

    return (schedule.overrides || []).some(ov => new Date(ov.date).toDateString() === day.toDateString());
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="max-w-3xl mx-auto">
            <Link href={`/lawyers/${lawyer.id}`} className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                กลับไปที่โปรไฟล์ทนาย
            </Link>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={lawyer.imageUrl} alt={lawyer.name} />
                            <AvatarFallback>{lawyer.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                             <CardTitle className="text-2xl font-headline">นัดหมายเพื่อปรึกษา</CardTitle>
                             <CardDescription>กับคุณ {lawyer.name}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <h3 className="font-semibold">1. เลือกวันที่สะดวก</h3>
                        <div className="flex justify-center p-2 border rounded-md">
                           <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                disabled={isDateUnavailable}
                                className="rounded-md"
                            />
                        </div>
                         {date && <p className="text-sm text-center text-muted-foreground">วันที่เลือก: {format(date, 'd MMMM yyyy')} (เวลาทำการ {lawyer.schedule?.workingHours.start || '09:00'}-{lawyer.schedule?.workingHours.end || '18:00'} น.)</p>}
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold">2. อธิบายปัญหาของคุณโดยย่อ</h3>
                        <Textarea 
                            placeholder="เพื่อให้ทนายความเตรียมข้อมูลเบื้องต้น..." 
                            rows={5}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <Button onClick={handleSubmit} className="w-full" size="lg" disabled={!date || !description.trim() || isSubmitting}>
                        {isSubmitting ? 'กำลังส่งคำขอ...' : 'ส่งคำขอนัดหมาย (ไม่มีค่าใช้จ่ายผ่านระบบ)'}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                        หากมีค่าบริการ ทนายจะแจ้งในแชทและคุณโอนให้ทนายโดยตรง — Lawslane ไม่ได้รับหรือถือเงิน
                    </p>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  )
}
