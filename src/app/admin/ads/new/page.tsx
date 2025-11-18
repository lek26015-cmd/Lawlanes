
'use client'

import * as React from 'react'
import {
  ChevronLeft,
  Upload,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
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
import { Textarea } from '@/components/ui/textarea'
import Image from 'next/image'

export default function AdminAdCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [title, setTitle] = React.useState('');

  const handleSaveChanges = () => {
    toast({
        title: "สร้างโฆษณาสำเร็จ",
        description: `โฆษณาใหม่ "${title || 'โฆษณาใหม่'}" ได้ถูกเพิ่มเข้าสู่ระบบแล้ว`,
    })
    router.push('/admin/ads');
  }

  return (
      <main className="flex-1 p-4 sm:px-6 sm:py-0 md:p-8">
        <div className="mx-auto grid max-w-2xl flex-1 auto-rows-max gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/ads">
                <Button variant="outline" size="icon" className="h-7 w-7">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">กลับ</span>
                </Button>
            </Link>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
              เพิ่มโฆษณาใหม่
            </h1>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Link href="/admin/ads">
                <Button variant="outline" size="sm">
                    ยกเลิก
                </Button>
              </Link>
              <Button size="sm" onClick={handleSaveChanges}>
                บันทึกโฆษณา
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>รายละเอียดโฆษณา</CardTitle>
              <CardDescription>
                กรอกเนื้อหา, รูปภาพ, และสถานะของโฆษณาใหม่
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="picture">รูปภาพ</Label>
                  <div className="flex items-center gap-4">
                    <div className="aspect-video w-48 rounded-md object-contain bg-muted border flex items-center justify-center">
                        <span className="text-muted-foreground text-xs">Preview</span>
                    </div>
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2"/>
                      อัปโหลดรูป
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="title">หัวข้อโฆษณา</Label>
                  <Input
                    id="title"
                    type="text"
                    className="w-full"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="เช่น โปรโมชั่นพิเศษ..."
                  />
                </div>
                 <div className="grid gap-3">
                  <Label htmlFor="description">คำอธิบาย</Label>
                  <Textarea
                    id="description"
                    placeholder="คำอธิบายสั้นๆ เกี่ยวกับโฆษณา"
                  />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-3">
                        <Label htmlFor="placement">ตำแหน่ง</Label>
                        <Select defaultValue="Homepage Carousel">
                            <SelectTrigger id="placement">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Homepage Carousel">แบนเนอร์หน้าแรก</SelectItem>
                                <SelectItem value="Lawyer Page Sidebar">ไซด์บาร์หน้าทนาย</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-3">
                        <Label htmlFor="status">สถานะ</Label>
                        <Select defaultValue="draft">
                            <SelectTrigger id="status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                                 <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>
           <div className="flex items-center justify-end gap-2 md:hidden">
              <Link href="/admin/ads">
                <Button variant="outline" size="sm">
                    ยกเลิก
                </Button>
              </Link>
              <Button size="sm" onClick={handleSaveChanges}>
                บันทึกโฆษณา
              </Button>
            </div>
        </div>
      </main>
  )
}
