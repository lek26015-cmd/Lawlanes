
'use client';

import * as React from 'react';
import { ChevronLeft, PlusCircle, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const permissionsConfig = [
  { id: 'customers', label: 'ลูกค้า', actions: ['view', 'create', 'edit', 'delete', 'download'] },
  { id: 'lawyers', label: 'ทนายความ', actions: ['view', 'create', 'edit', 'delete', 'download'] },
  { id: 'financials', label: 'การเงิน', actions: ['view', 'download'] },
  { id: 'tickets', label: 'Ticket ช่วยเหลือ', actions: ['view', 'reply'] },
  { id: 'ads', label: 'จัดการโฆษณา', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'content', label: 'จัดการเนื้อหา', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'settings', label: 'ตั้งค่าระบบ', actions: ['view', 'edit'] },
];

const actionLabels: { [key: string]: string } = {
  view: 'ดู',
  create: 'สร้าง',
  edit: 'แก้ไข',
  delete: 'ลบ',
  download: 'ดาวน์โหลด',
  reply: 'ตอบกลับ',
};

export default function AdminCreateAdministratorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [permissions, setPermissions] = React.useState<Record<string, string[]>>({});

  const handlePermissionChange = (menuId: string, action: string, checked: boolean) => {
    setPermissions(prev => {
        const currentActions = prev[menuId] || [];
        if (checked) {
            return { ...prev, [menuId]: [...currentActions, action] };
        } else {
            return { ...prev, [menuId]: currentActions.filter(a => a !== action) };
        }
    });
  }

  const handleSaveChanges = () => {
    toast({
      title: 'เพิ่มผู้ดูแลสำเร็จ',
      description: `ผู้ดูแลระบบ "${name || 'ผู้ใช้ใหม่'}" ได้ถูกเพิ่มเข้าสู่ระบบพร้อมสิทธิ์ที่กำหนดแล้ว`,
    });
    console.log("Creating new admin with permissions:", permissions);
    router.push('/admin/settings/administrators');
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="mx-auto grid w-full max-w-4xl flex-1 auto-rows-max gap-4">
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
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>ข้อมูลผู้ดูแลระบบ</CardTitle>
                    <CardDescription>กรอกข้อมูลส่วนตัวของผู้ดูแลใหม่</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
                        <div className="grid gap-3 sm:col-span-2">
                            <Label htmlFor="password">รหัสผ่านชั่วคราว</Label>
                            <Input id="password" type="password" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>กำหนดสิทธิ์การเข้าถึง</CardTitle>
                <CardDescription>
                  เลือกเมนูและกำหนดการกระทำที่ผู้ดูแลใหม่สามารถทำได้
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {permissionsConfig.map((menu, index) => (
                    <React.Fragment key={menu.id}>
                        <div className="grid grid-cols-[1fr_2fr] gap-4 items-start">
                            <Label className="font-semibold text-base pt-3">{menu.label}</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-secondary/50">
                                {menu.actions.map(action => (
                                    <div key={action} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`${menu.id}-${action}`}
                                            checked={permissions[menu.id]?.includes(action) || false}
                                            onCheckedChange={(checked) => handlePermissionChange(menu.id, action, !!checked)}
                                        />
                                        <Label htmlFor={`${menu.id}-${action}`} className="font-normal text-sm">
                                            {actionLabels[action]}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {index < permissionsConfig.length - 1 && <Separator />}
                    </React.Fragment>
                  ))}
                </div>
              </CardContent>
            </Card>
        </div>
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
