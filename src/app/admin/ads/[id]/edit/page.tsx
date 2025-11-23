
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
import type { Ad } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea'
import Image from 'next/image'
import { useFirebase } from '@/firebase'
import { getAdById } from '@/lib/data'
import { doc, updateDoc } from 'firebase/firestore'
import { errorEmitter, FirestorePermissionError } from '@/firebase'


export default function AdminAdEditPage() {
  const params = useParams()
  const router = useRouter()
  const { id } = params
  const { toast } = useToast()
  const { firestore } = useFirebase();

  const [ad, setAd] = React.useState<Ad | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!firestore || !id) return;
    getAdById(firestore, id as string).then(setAd);
  }, [id, firestore]);

  const handleSaveChanges = async () => {
    if (!firestore || !ad) return;
    setIsSaving(true);
    
    const adRef = doc(firestore, 'ads', ad.id);
    const updatedData = {
        title: ad.title,
        description: ad.description,
        placement: ad.placement,
        status: ad.status,
    };
    
    updateDoc(adRef, updatedData).then(() => {
        toast({
            title: "บันทึกข้อมูลสำเร็จ",
            description: `โฆษณา "${ad.title}" ได้รับการอัปเดตแล้ว`,
        })
        router.push(`/admin/ads`);
    }).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: adRef.path,
            operation: 'update',
            requestResourceData: updatedData,
          });
        errorEmitter.emit('permission-error', permissionError);
    }).finally(() => {
        setIsSaving(false);
    });
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!ad) return;
    const { id, value } = e.target;
    setAd({ ...ad, [id]: value });
  };
  
  const handleSelectChange = (id: 'placement' | 'status') => (value: string) => {
    if (!ad) return;
    setAd({ ...ad, [id]: value });
  }

  if (!ad) {
    return <div>Loading...</div>
  }

  return (
      <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
        <div className="mx-auto grid max-w-[59rem] flex-1 auto-rows-max gap-4">
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
                <Button variant="outline" size="sm" disabled={isSaving}>
                    ยกเลิก
                </Button>
              </Link>
              <Button size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
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
                      เปลี่ยนรูป (จำลอง)
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="title">หัวข้อโฆษณา</Label>
                  <Input
                    id="title"
                    type="text"
                    className="w-full"
                    value={ad.title}
                    onChange={handleInputChange}
                  />
                </div>
                 <div className="grid gap-3">
                  <Label htmlFor="description">คำอธิบาย</Label>
                  <Textarea
                    id="description"
                    value={ad.description}
                    onChange={handleInputChange}
                  />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-3">
                        <Label htmlFor="placement">ตำแหน่ง</Label>
                        <Select value={ad.placement} onValueChange={handleSelectChange('placement')}>
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
                        <Select value={ad.status} onValueChange={handleSelectChange('status')}>
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
                <Button variant="outline" size="sm" disabled={isSaving}>
                    ยกเลิก
                </Button>
              </Link>
              <Button size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                 {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
              </Button>
            </div>
        </div>
      </main>
  )
}
