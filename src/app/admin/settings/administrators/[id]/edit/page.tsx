
'use client';

import * as React from 'react';
import { ChevronLeft, PlusCircle, Trash2 } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const mockAdmins = [
    { id: 'admin-1', name: 'แอดมินหลัก', email: 'admin@lawlanes.com', role: 'Super Admin' },
    { id: 'admin-2', name: 'สมศรี มีชัย', email: 'somsri.m@lawlanes.com', role: 'Content Manager' },
    { id: 'admin-3', name: 'วิชัย รักดี', email: 'wichai.r@lawlanes.com', role: 'Support Lead' },
];

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

export default function AdminEditAdministratorPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const { toast } = useToast();

  const [admin, setAdmin] = React.useState<(typeof mockAdmins[0]) | null>(null);
  
  // Mock permissions state for the selected admin
  const [permissions, setPermissions] = React.useState<Record<string, string[]>>({
      customers: ['view', 'edit'],
      lawyers: ['view'],
      tickets: ['view', 'reply']
  });

  React.useEffect(() => {
    const foundAdmin = mockAdmins.find(a => a.id === id);
    // @ts-ignore
    setAdmin(foundAdmin || null);
  }, [id]);

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
    if (!admin) return;
    console.log("Saving permissions for", admin.email, permissions);
    toast({
      title: 'แก้ไขสิทธิ์สำเร็จ',
      description: `สิทธิ์การเข้าถึงของ "${admin.name}" ได้รับการอัปเดตแล้ว`,
    });
    router.push('/admin/settings/administrators');
  };
  
  if (!admin) {
      return <div>Loading...</div>
  }

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
            แก้ไขสิทธิ์ผู้ดูแลระบบ
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
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>ข้อมูลผู้ใช้</CardTitle>
                </CardHeader>
                <CardContent>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-3">
                            <Label htmlFor="name">ชื่อ-นามสกุล</Label>
                            <Input id="name" type="text" className="w-full" defaultValue={admin.name}/>
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="email">อีเมล</Label>
                            <Input id="email" type="email" className="w-full" defaultValue={admin.email} disabled/>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>กำหนดสิทธิ์การเข้าถึง</CardTitle>
                <CardDescription>
                  เลือกเมนูและกำหนดการกระทำที่ <span className="font-semibold">{admin.name}</span> สามารถทำได้
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
                                            checked={permissions[menu.id]?.includes(action)}
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
              บันทึกการเปลี่ยนแปลง
            </Button>
        </div>
      </div>
    </main>
  );
}
