
'use client'

import * as React from 'react'
import {
  ChevronLeft,
  Upload,
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { mockLawyers as allMockLawyers } from '@/lib/data'
import type { LawyerProfile } from '@/lib/types';
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'

export default function AdminLawyerEditPage() {
  const params = useParams()
  const router = useRouter()
  const { id } = params
  const { toast } = useToast()

  const [lawyer, setLawyer] = React.useState<LawyerProfile | null>(null);

  React.useEffect(() => {
    const foundLawyer = allMockLawyers.find(l => l.id === id);
    // @ts-ignore
    setLawyer(foundLawyer || null);
  }, [id]);

  const handleSaveChanges = () => {
    toast({
        title: "บันทึกข้อมูลสำเร็จ",
        description: `ข้อมูลของทนาย ${lawyer?.name} ได้รับการอัปเดตแล้ว`,
    })
    router.push(`/admin/lawyers/${id}`);
  }

  if (!lawyer) {
    return <div>Loading...</div>
  }
  
  const allSpecialties = ['คดีฉ้อโกง SMEs', 'คดีแพ่งและพาณิชย์', 'การผิดสัญญา', 'ทรัพย์สินทางปัญญา', 'กฎหมายแรงงาน'];


  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <main className="flex-1 p-4 sm:px-6 sm:py-0 md:p-8">
        <div className="mx-auto grid max-w-2xl flex-1 auto-rows-max gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/admin/lawyers/${id}`}>
                <Button variant="outline" size="icon" className="h-7 w-7">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">กลับ</span>
                </Button>
            </Link>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
              แก้ไขข้อมูลทนายความ
            </h1>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Link href={`/admin/lawyers/${id}`}>
                <Button variant="outline" size="sm">
                    ยกเลิก
                </Button>
              </Link>
              <Button size="sm" onClick={handleSaveChanges}>
                บันทึกการเปลี่ยนแปลง
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลโปรไฟล์</CardTitle>
              <CardDescription>
                จัดการข้อมูลส่วนตัวและสถานะของทนายความ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="picture">รูปโปรไฟล์</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={lawyer.imageUrl} />
                      <AvatarFallback>{lawyer.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2"/>
                      เปลี่ยนรูป
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="name">ชื่อ-นามสกุล</Label>
                  <Input
                    id="name"
                    type="text"
                    className="w-full"
                    defaultValue={lawyer.name}
                  />
                </div>
                <div className="grid gap-3">
                    <Label htmlFor="status">สถานะ</Label>
                    <Select defaultValue={lawyer.status}>
                        <SelectTrigger id="status">
                            <SelectValue placeholder="เลือกสถานะ" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                            <SelectItem value="pending">รอตรวจสอบ</SelectItem>
                            <SelectItem value="rejected">ถูกปฏิเสธ</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-3">
                  <Label>ความเชี่ยวชาญ</Label>
                   <div className="grid grid-cols-2 gap-2">
                        {allSpecialties.map(spec => (
                            <div key={spec} className="flex items-center space-x-2 p-2 rounded-md bg-secondary/50">
                                <Checkbox 
                                    id={`spec-${spec}`} 
                                    defaultChecked={lawyer.specialty.includes(spec)}
                                />
                                <Label htmlFor={`spec-${spec}`} className="text-sm font-normal">{spec}</Label>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
