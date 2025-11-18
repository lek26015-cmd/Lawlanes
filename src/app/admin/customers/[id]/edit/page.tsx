
'use client'

import * as React from 'react'
import {
  ChevronLeft,
  Upload,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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

const mockCustomer = {
    id: "cus_001",
    name: "สมหญิง ใจดี",
    email: "somying.j@example.com",
    avatar: "https://picsum.photos/seed/user-avatar/100/100",
    registeredAt: "2024-06-15",
    type: "บุคคลทั่วไป",
    status: "active",
};


export default function AdminCustomerEditPage() {
  const params = useParams()
  const { id } = params
  const { toast } = useToast()

  // In a real app, you would fetch customer data based on the id
  const [customer, setCustomer] = React.useState(mockCustomer)

  const handleSaveChanges = () => {
    toast({
        title: "บันทึกข้อมูลสำเร็จ",
        description: `ข้อมูลของลูกค้า ${customer.name} ได้รับการอัปเดตแล้ว`,
    })
  }

  return (
      <main className="flex-1 p-4 sm:px-6 sm:py-0 md:p-8">
        <div className="mx-auto grid max-w-2xl flex-1 auto-rows-max gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/admin/customers/${id}`}>
                <Button variant="outline" size="icon" className="h-7 w-7">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">กลับ</span>
                </Button>
            </Link>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
              แก้ไขข้อมูลลูกค้า
            </h1>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Link href={`/admin/customers/${id}`}>
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
                จัดการข้อมูลส่วนตัวและสถานะบัญชีของลูกค้า
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="picture">รูปโปรไฟล์</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={customer.avatar} />
                      <AvatarFallback>{customer.name.slice(0, 2)}</AvatarFallback>
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
                    defaultValue={customer.name}
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="email">อีเมล</Label>
                   <Input
                    id="email"
                    type="email"
                    className="w-full"
                    defaultValue={customer.email}
                  />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-3">
                        <Label htmlFor="type">ประเภทลูกค้า</Label>
                        <Select defaultValue={customer.type}>
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
                        <Select defaultValue={customer.status}>
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
        </div>
      </main>
  )
}
