
'use client'

import * as React from 'react'
import { ChevronLeft, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'

export default function AdminLawyerCreatePage() {
  const { toast } = useToast()
  const router = useRouter()
  
  const [name, setName] = React.useState('');
  const allSpecialties = ['คดีฉ้อโกง SMEs', 'คดีแพ่งและพาณิชย์', 'การผิดสัญญา', 'ทรัพย์สินทางปัญญา', 'กฎหมายแรงงาน'];

  const handleSaveChanges = () => {
    toast({
        title: "สร้างโปรไฟล์สำเร็จ",
        description: `ทนายความ ${name || 'คนใหม่'} ได้ถูกเพิ่มเข้าสู่ระบบแล้ว`,
    })
    router.push('/admin/lawyers');
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <main className="flex-1 p-4 sm:px-6 sm:py-0 md:p-8">
        <div className="mx-auto grid max-w-2xl flex-1 auto-rows-max gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/lawyers">
                <Button variant="outline" size="icon" className="h-7 w-7">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">กลับ</span>
                </Button>
            </Link>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
              เพิ่มทนายความใหม่
            </h1>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Link href="/admin/lawyers">
                <Button variant="outline" size="sm">ยกเลิก</Button>
              </Link>
              <Button size="sm" onClick={handleSaveChanges}>บันทึกโปรไฟล์</Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลโปรไฟล์</CardTitle>
              <CardDescription>กรอกข้อมูลและสถานะของทนายความใหม่</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="picture">รูปโปรไฟล์</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src="" />
                      <AvatarFallback>ทน</AvatarFallback>
                    </Avatar>
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2"/>
                      อัปโหลดรูป
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="name">ชื่อ-นามสกุล</Label>
                  <Input
                    id="name"
                    type="text"
                    className="w-full"
                    placeholder="สมชาย กฎหมายดี"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                 <div className="grid gap-3">
                  <Label htmlFor="license">เลขใบอนุญาต</Label>
                  <Input id="license" type="text" placeholder="12345/2550"/>
                </div>
                <div className="grid gap-3">
                    <Label htmlFor="status">สถานะ</Label>
                    <Select defaultValue="pending">
                        <SelectTrigger id="status">
                            <SelectValue />
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
                                <Checkbox id={`spec-${spec}`} />
                                <Label htmlFor={`spec-${spec}`} className="text-sm font-normal">{spec}</Label>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>
           <div className="flex items-center justify-end gap-2 md:hidden">
                <Link href="/admin/lawyers">
                    <Button variant="outline" size="sm">ยกเลิก</Button>
                </Link>
                <Button size="sm" onClick={handleSaveChanges}>บันทึกโปรไฟล์</Button>
            </div>
        </div>
      </main>
    </div>
  )
}
