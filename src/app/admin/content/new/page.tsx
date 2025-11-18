
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

export default function AdminArticleCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [title, setTitle] = React.useState('');

  const handleSaveChanges = () => {
    toast({
        title: "สร้างบทความสำเร็จ",
        description: `บทความใหม่ "${title || 'บทความใหม่'}" ได้ถูกเพิ่มเข้าสู่ระบบแล้ว`,
    })
    router.push('/admin/content');
  }
  
  const categories = ['กฎหมายแรงงาน', 'กฎหมายธุรกิจ', 'ทรัพย์สินทางปัญญา', 'คดีฉ้อโกง', 'กฎหมายแพ่ง'];


  return (
      <main className="flex-1 p-4 sm:px-6 sm:py-0 md:p-8">
        <div className="mx-auto grid max-w-2xl flex-1 auto-rows-max gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/content">
                <Button variant="outline" size="icon" className="h-7 w-7">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">กลับ</span>
                </Button>
            </Link>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
              สร้างบทความใหม่
            </h1>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Link href="/admin/content">
                <Button variant="outline" size="sm">
                    ยกเลิก
                </Button>
              </Link>
              <Button size="sm" onClick={handleSaveChanges}>
                บันทึกบทความ
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>รายละเอียดบทความ</CardTitle>
              <CardDescription>
                กรอกเนื้อหา, รูปภาพ, และหมวดหมู่สำหรับบทความใหม่
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="picture">รูปภาพหน้าปก</Label>
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
                  <Label htmlFor="title">หัวข้อบทความ</Label>
                  <Input
                    id="title"
                    type="text"
                    className="w-full"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="เช่น 5 สิ่งต้องรู้ก่อนเซ็นสัญญา..."
                  />
                </div>
                <div className="grid gap-3">
                    <Label htmlFor="category">หมวดหมู่</Label>
                    <Select>
                        <SelectTrigger id="category">
                            <SelectValue placeholder="เลือกหมวดหมู่" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-3">
                  <Label htmlFor="description">คำอธิบายสั้นๆ (Description)</Label>
                  <Textarea
                    id="description"
                    placeholder="คำอธิบายสั้นๆ ที่จะแสดงในหน้าแรกและผลการค้นหา"
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="content">เนื้อหาบทความ</Label>
                  <Textarea
                    id="content"
                    placeholder="เนื้อหาฉบับเต็มของบทความ..."
                    rows={15}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
           <div className="flex items-center justify-end gap-2 md:hidden">
              <Link href="/admin/content">
                <Button variant="outline" size="sm">
                    ยกเลิก
                </Button>
              </Link>
              <Button size="sm" onClick={handleSaveChanges}>
                บันทึกบทความ
              </Button>
            </div>
        </div>
      </main>
  )
}
