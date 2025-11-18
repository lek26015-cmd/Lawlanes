
'use client';

import * as React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const mockAdmins = [
    { id: 'admin-1', name: 'แอดมินหลัก', email: 'admin@lawlanes.com', role: 'Super Admin' },
    { id: 'admin-2', name: 'สมศรี มีชัย', email: 'somsri.m@lawlanes.com', role: 'Content Manager' },
    { id: 'admin-3', name: 'วิชัย รักดี', email: 'wichai.r@lawlanes.com', role: 'Support Lead' },
];

export default function AdminEditAdministratorPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const { toast } = useToast();

  const [admin, setAdmin] = React.useState<typeof mockAdmins[0] | null>(null);

   React.useEffect(() => {
    const foundAdmin = mockAdmins.find(a => a.id === id);
    setAdmin(foundAdmin || null);
  }, [id]);

  const handleSaveChanges = () => {
    if (!admin) return;
    toast({
      title: 'แก้ไขข้อมูลสำเร็จ',
      description: `ข้อมูลของผู้ดูแลระบบ "${admin.name}" ได้รับการอัปเดตแล้ว`,
    });
    router.push('/admin/settings/administrators');
  };
  
  if (!admin) {
      return <div>Loading...</div>
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="mx-auto grid w-full max-w-2xl flex-1 auto-rows-max gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/settings/administrators">
            <Button variant="outline" size="icon" className="h-7 w-7">
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">กลับ</span>
            </Button>
          </Link>
          <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
            แก้ไขข้อมูลผู้ดูแลระบบ
          </h1>
          <div className="hidden items-center gap-2 md:ml-auto md:flex">
            <Link href="/admin/settings/administrators">
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
            <CardTitle>ข้อมูลผู้ดูแลระบบ</CardTitle>
            <CardDescription>
              แก้ไขข้อมูลและตำแหน่งของผู้ดูแลระบบ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-3">
                    <Label htmlFor="name">ชื่อ-นามสกุล</Label>
                    <Input
                        id="name"
                        type="text"
                        className="w-full"
                        defaultValue={admin.name}
                    />
                </div>
                 <div className="grid gap-3">
                    <Label htmlFor="email">อีเมล</Label>
                    <Input
                        id="email"
                        type="email"
                        className="w-full"
                        defaultValue={admin.email}
                    />
                </div>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="role">ตำแหน่ง</Label>
                <Select defaultValue={admin.role}>
                  <SelectTrigger id="role" aria-label="Select role">
                    <SelectValue placeholder="เลือกตำแหน่ง" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Super Admin">Super Admin</SelectItem>
                    <SelectItem value="Content Manager">Content Manager</SelectItem>
                    <SelectItem value="Support Lead">Support Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
               <div className="grid gap-3">
                  <Label htmlFor="password">ตั้งรหัสผ่านใหม่ (ถ้าต้องการ)</Label>
                  <Input id="password" type="password" placeholder="เว้นว่างไว้หากไม่ต้องการเปลี่ยน" />
                </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-end gap-2 md:hidden">
            <Link href="/admin/settings/administrators">
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
  );
}
