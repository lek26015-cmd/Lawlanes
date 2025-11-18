
'use client';

import * as React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
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

export default function AdminCreateAdministratorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState('');

  const handleSaveChanges = () => {
    toast({
      title: 'เพิ่มผู้ดูแลสำเร็จ',
      description: `ผู้ดูแลระบบ "${name || 'ผู้ใช้ใหม่'}" ได้ถูกเพิ่มเข้าสู่ระบบแล้ว`,
    });
    router.push('/admin/settings/administrators');
  };

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
            เพิ่มผู้ดูแลระบบใหม่
          </h1>
          <div className="hidden items-center gap-2 md:ml-auto md:flex">
            <Link href="/admin/settings/administrators">
              <Button variant="outline" size="sm">
                ยกเลิก
              </Button>
            </Link>
            <Button size="sm" onClick={handleSaveChanges}>
              บันทึก
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลผู้ดูแลระบบ</CardTitle>
            <CardDescription>
              กรอกข้อมูลและกำหนดตำแหน่งของผู้ดูแลระบบใหม่
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
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="สมชาย ใจดี"
                    />
                </div>
                 <div className="grid gap-3">
                    <Label htmlFor="email">อีเมล</Label>
                    <Input
                        id="email"
                        type="email"
                        className="w-full"
                        placeholder="somchai.j@lawlanes.com"
                    />
                </div>
              </div>
               <div className="grid gap-3">
                  <Label htmlFor="password">รหัสผ่านชั่วคราว</Label>
                  <Input id="password" type="password" />
                </div>
              <div className="grid gap-3">
                <Label htmlFor="role">ตำแหน่ง</Label>
                <Select>
                  <SelectTrigger id="role" aria-label="Select role">
                    <SelectValue placeholder="เลือกตำแหน่ง" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super-admin">Super Admin</SelectItem>
                    <SelectItem value="content-manager">Content Manager</SelectItem>
                    <SelectItem value="support-lead">Support Lead</SelectItem>
                  </SelectContent>
                </Select>
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
              บันทึก
            </Button>
        </div>
      </div>
    </main>
  );
}
