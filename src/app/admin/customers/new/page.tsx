
'use client'

import * as React from 'react'
import {
  ChevronLeft,
  Upload,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
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


export default function AdminCustomerCreatePage() {
  const { toast } = useToast()
  const router = useRouter()
  
  const [name, setName] = React.useState('');

  const handleSaveChanges = () => {
    toast({
        title: "สร้างลูกค้าสำเร็จ",
        description: `ลูกค้าใหม่ ${name || 'ลูกค้า'} ได้ถูกเพิ่มเข้าสู่ระบบแล้ว`,
    })
    router.push(`/admin/customers`);
  }

  return (
      <main className="flex-1 p-4 sm:px-6 sm:py-0 md:p-8">
        <div className="mx-auto grid max-w-2xl flex-1 auto-rows-max gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/admin/customers`}>
                <Button variant="outline" size="icon" className="h-7 w-7">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">กลับ</span>
                </Button>
            </Link>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
              เพิ่มลูกค้าใหม่
            </h1>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Link href={`/admin/customers`}>
                <Button variant="outline" size="sm">
                    ยกเลิก
                </Button>
              </Link>
              <Button size="sm" onClick={handleSaveChanges}>
                บันทึกลูกค้า
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลโปรไฟล์</CardTitle>
              <CardDescription>
                กรอกข้อมูลส่วนตัวและสถานะบัญชีของลูกค้าใหม่
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="picture">รูปโปรไฟล์</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback>ลค</AvatarFallback>
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
                    placeholder="สมหญิง ใจดี"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="email">อีเมล</Label>
                   <Input
                    id="email"
                    type="email"
                    className="w-full"
                    placeholder="somying.j@example.com"
                  />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-3">
                        <Label htmlFor="type">ประเภทลูกค้า</Label>
                        <Select defaultValue="บุคคลทั่วไป">
                            <SelectTrigger id="type">
                                <SelectValue placeholder="เลือกประเภท" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="บุคคลทั่วไป">บุคคลทั่วไป</SelectItem>
                                <SelectItem value="SME">SME</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-3">
                        <Label htmlFor="status">สถานะบัญชี</Label>
                        <Select defaultValue="active">
                            <SelectTrigger id="status">
                                <SelectValue placeholder="เลือกสถานะ" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>
           <div className="flex items-center justify-end gap-2 md:hidden">
              <Link href={`/admin/customers`}>
                <Button variant="outline" size="sm">
                    ยกเลิก
                </Button>
              </Link>
              <Button size="sm" onClick={handleSaveChanges}>
                บันทึกลูกค้า
              </Button>
            </div>
        </div>
      </main>
  )
}
