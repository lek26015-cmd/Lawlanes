
'use client'

import * as React from 'react'
import {
  ChevronLeft,
  Download,
  ShieldCheck,
  ShieldX,
  Clock,
  MoreVertical,
  User,
  FileText,
  Eye
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getLawyerById } from '@/lib/data'
import type { LawyerProfile } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
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
import { useFirebase } from '@/firebase'
import { doc, updateDoc } from 'firebase/firestore'

export default function AdminLawyerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { id } = params
  const { toast } = useToast()
  const { firestore } = useFirebase();

  const [lawyer, setLawyer] = React.useState<LawyerProfile | null>(null);
  const [currentDate, setCurrentDate] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCurrentDate(new Date().toISOString());
    if (!firestore || !id) return;

    getLawyerById(firestore, id as string).then(foundLawyer => {
      setLawyer(foundLawyer || null);
    });
  }, [id, firestore]);

  const handleStatusChange = (newStatus: LawyerProfile['status']) => {
    if (!lawyer || !firestore) return;

    const lawyerRef = doc(firestore, 'lawyerProfiles', lawyer.id);
    updateDoc(lawyerRef, { status: newStatus }).then(() => {
      toast({
        title: 'เปลี่ยนสถานะสำเร็จ',
        description: `สถานะของ ${lawyer.name} ถูกเปลี่ยนเป็น "${newStatus}"`,
      });
      setLawyer(prev => prev ? { ...prev, status: newStatus } : null);
    }).catch(err => {
      console.error(err);
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถเปลี่ยนสถานะได้' })
    })
  };

  if (!lawyer) {
    return <div>Loading...</div>
  }

  const statusBadges: Record<LawyerProfile['status'], React.ReactNode> = {
    approved: <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 gap-1"><ShieldCheck className="w-3 h-3" />อนุมัติแล้ว</Badge>,
    pending: <Badge variant="outline" className="border-yellow-600 text-yellow-700 bg-yellow-50 gap-1"><Clock className="w-3 h-3" />รอตรวจสอบ</Badge>,
    rejected: <Badge variant="destructive" className="bg-red-100/50 text-red-800 border-red-200/50 gap-1"><ShieldX className="w-3 h-3" />ถูกปฏิเสธ</Badge>,
  }

  const mockCases = [
    { id: 'case-001', title: 'ตรวจสอบสัญญาเช่า', client: 'สมหญิง ใจดี', fee: 3500, status: 'เสร็จสิ้น' },
    { id: 'case-002', title: 'จดทะเบียนบริษัท', client: 'บริษัท เติบโต จำกัด', fee: 5000, status: 'เสร็จสิ้น' },
  ]

  const mockDocuments = [
    { name: 'ใบอนุญาตว่าความ.pdf', url: '#' },
    { name: 'สำเนาบัตรประชาชน.pdf', url: '#' },
    { name: 'transcript.pdf', url: '#' },
  ]
  const handleViewDocument = (url: string | undefined) => {
    if (!url || url === '#' || url === '') {
      toast({
        variant: "destructive",
        title: "ไม่พบเอกสาร",
        description: "เอกสารนี้ยังไม่ได้ถูกอัปโหลด (ข้อมูลจำลอง)",
      });
      return;
    }
    window.open(url, '_blank');
  };
  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
      <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
        <div className="flex items-center gap-4">
          <Link href="/admin/lawyers">
            <Button variant="outline" size="icon" className="h-7 w-7">
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">กลับ</span>
            </Button>
          </Link>
          <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
            โปรไฟล์ทนายความ
          </h1>
          <div className="ml-auto sm:ml-0">
            {statusBadges[lawyer.status]}
          </div>
          <div className="hidden items-center gap-2 md:ml-auto md:flex">
            <Link href={`/admin/lawyers/${id}/edit`}>
              <Button variant="outline" size="sm">แก้ไขข้อมูล (จำลอง)</Button>
            </Link>
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">การดำเนินการ</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={lawyer.status === 'approved'}>อนุมัติ</DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={lawyer.status === 'pending'}>ย้ายไปรอตรวจสอบ</DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive" disabled={lawyer.status === 'rejected'}>ปฏิเสธ</DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ยืนยันการดำเนินการ</AlertDialogTitle>
                  <AlertDialogDescription>
                    คุณแน่ใจหรือไม่ที่จะเปลี่ยนสถานะของทนายความท่านนี้ การกระทำนี้สามารถเปลี่ยนแปลงได้ในภายหลัง
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleStatusChange(lawyer.status !== 'approved' ? 'approved' : 'pending')}>ยืนยัน</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>ประวัติเคสล่าสุด (จำลอง)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสเคส</TableHead>
                  <TableHead>หัวข้อ</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>ค่าบริการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockCases.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{c.id}</TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell>{c.client}</TableCell>
                    <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                    <TableCell>฿{c.fee.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>เอกสารประกอบการสมัคร (จำลอง)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {[
                { name: 'ใบอนุญาตว่าความ', url: lawyer.licenseUrl },
                { name: 'สำเนาบัตรประชาชน', url: lawyer.idCardUrl },
              ].map((doc, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border bg-background p-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{doc.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDocument(doc.url)}>
                      <Eye className="mr-2 h-4 w-4" />ดูเอกสาร
                    </Button>
                    <Button variant="outline" size="sm" asChild disabled={!doc.url}>
                      <a href={doc.url} download target="_blank"><Download className="mr-2 h-4 w-4" />ดาวน์โหลด</a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start bg-muted/50">
            <div className="grid gap-0.5">
              <CardTitle className="group flex items-center gap-2 text-lg">
                ข้อมูลทนายความ
              </CardTitle>
              <CardDescription>
                เข้าร่วมเมื่อ: {lawyer.joinedAt?.toDate ? format(lawyer.joinedAt.toDate(), 'd MMM yyyy', { locale: th }) : 'N/A'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6 text-sm">
            <div className="grid gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={lawyer.imageUrl} />
                  <AvatarFallback>{lawyer.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="grid gap-1">
                  <p className="font-medium text-lg">{lawyer.name}</p>
                  <p className="text-muted-foreground">ID: {lawyer.userId}</p>
                </div>
              </div>
              <Separator />
              <div className="font-semibold">ความเชี่ยวชาญ</div>
              <div className="flex flex-wrap gap-2">
                {lawyer.specialty.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
              </div>
              <Separator />
              <div className="font-semibold">หมายเหตุสำหรับแอดมิน</div>
              <Textarea placeholder="เพิ่มหมายเหตุเกี่ยวกับทนายคนนี้..." />
            </div>
          </CardContent>
          <CardFooter className="flex flex-row items-center border-t bg-muted/50 px-6 py-3">
            <div className="text-xs text-muted-foreground">
              {currentDate && <time dateTime={currentDate}>อัปเดตล่าสุดเมื่อสักครู่</time>}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="ghost">บันทึก</Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
