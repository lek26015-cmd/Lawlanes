
'use client'

import * as React from 'react'
import {
  ChevronLeft,
  Upload,
} from 'lucide-react'

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
import { useParams, useRouter } from 'next/navigation'
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
import { useFirebase } from '@/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import type { UserProfile } from '@/lib/types'


export default function AdminCustomerEditPage() {
  const params = useParams()
  const router = useRouter()
  const { id } = params
  const { toast } = useToast()
  const { firestore } = useFirebase()

  const [customer, setCustomer] = React.useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !id) return;
    const userRef = doc(firestore, 'users', id as string);
    getDoc(userRef).then(docSnap => {
      if (docSnap.exists()) {
        setCustomer(docSnap.data() as UserProfile);
      }
      setIsLoading(false);
    })
  }, [firestore, id]);

  const handleSaveChanges = () => {
    if (!firestore || !customer || !id) return;
    
    const userRef = doc(firestore, 'users', id as string);
    // Only updating fields that are editable in this form
    const updatedData = {
        name: customer.name,
        type: customer.type,
        status: customer.status,
    };

    updateDoc(userRef, updatedData).then(() => {
      toast({
          title: "บันทึกข้อมูลสำเร็จ",
          description: `ข้อมูลของลูกค้า ${customer.name} ได้รับการอัปเดตแล้ว`,
      })
      router.push(`/admin/customers`)
    }).catch(err => {
      console.error(err);
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถบันทึกข้อมูลได้'})
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!customer) return;
    const { id, value } = e.target;
    setCustomer({ ...customer, [id]: value });
  };
  
  const handleSelectChange = (id: 'type' | 'status') => (value: string) => {
    if (!customer) return;
    // @ts-ignore
    setCustomer({ ...customer, [id]: value });
  }
  
  if (isLoading) {
    return <div>กำลังโหลดข้อมูล...</div>
  }

  if (!customer) {
    return <div>ไม่พบข้อมูลลูกค้า</div>
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
              แก้ไขข้อมูลลูกค้า
            </h1>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Link href={`/admin/customers`}>
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
                      เปลี่ยนรูป (จำลอง)
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="name">ชื่อ-นามสกุล</Label>
                  <Input
                    id="name"
                    type="text"
                    className="w-full"
                    value={customer.name}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="email">อีเมล</Label>
                   <Input
                    id="email"
                    type="email"
                    className="w-full"
                    value={customer.email}
                    disabled
                  />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-3">
                        <Label htmlFor="type">ประเภทลูกค้า</Label>
                        <Select value={customer.type} onValueChange={handleSelectChange('type')}>
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
                        <Select value={customer.status} onValueChange={handleSelectChange('status')}>
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
                บันทึกการเปลี่ยนแปลง
              </Button>
            </div>
        </div>
      </main>
  )
}
