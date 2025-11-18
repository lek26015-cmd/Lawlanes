
'use client'

import * as React from 'react'
import {
  ChevronLeft,
  Upload,
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
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
import { mockAds } from '@/lib/data'
import type { Ad } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea'
import Image from 'next/image'

export default function AdminAdEditPage() {
  const params = useParams()
  const router = useRouter()
  const { id } = params
  const { toast } = useToast()

  const [ad, setAd] = React.useState<Ad | null>(null);

  React.useEffect(() => {
    const foundAd = mockAds.find(a => a.id === id);
    setAd(foundAd || null);
  }, [id]);

  const handleSaveChanges = () => {
    toast({
        title: "บันทึกข้อมูลสำเร็จ",
        description: `โฆษณา "${ad?.title}" ได้รับการอัปเดตแล้ว`,
    })
    router.push(`/admin/ads`);
  }

  if (!ad) {
    return <div>Loading...</div>
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
              แก้ไขโฆษณา
            </h1>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Link href="/admin/ads">
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
              <CardTitle>รายละเอียดโฆษณา</CardTitle>
              <CardDescription>
                จัดการเนื้อหา, รูปภาพ, และสถานะของโฆษณา
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="picture">รูปภาพ</Label>
                  <div className="flex items-center gap-4">
                    <Image
                        alt={ad.title}
                        className="aspect-video w-48 rounded-md object-contain bg-white p-1 border"
                        height="90"
                        src={ad.imageUrl}
                        width="160"
                    />
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2"/>
                      เปลี่ยนรูป
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="title">หัวข้อโฆษณา</Label>
                  <Input
                    id="title"
                    type="text"
                    className="w-full"
                    defaultValue={ad.title}
                  />
                </div>
                 <div className="grid gap-3">
                  <Label htmlFor="description">คำอธิบาย</Label>
                  <Textarea
                    id="description"
                    defaultValue={ad.description}
                  />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-3">
                        <Label htmlFor="placement">ตำแหน่ง</Label>
                        <Select defaultValue={ad.placement}>
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
                        <Select defaultValue={ad.status}>
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
                บันทึกการเปลี่ยนแปลง
              </Button>
            </div>
        </div>
      </main>
  )
}
