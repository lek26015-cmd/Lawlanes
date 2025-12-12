'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeftCircle, Loader2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { createAdminUser } from '@/app/actions/admin-management';
import { useRouter } from 'next/navigation';

export default function NewAdminPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState('admin');

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    formData.append('role', role);

    try {
      const result = await createAdminUser(null, formData);

      if (result.success) {
        toast({
          title: "สร้างผู้ดูแลระบบสำเร็จ",
          description: result.message,
        });
        router.push('/admin/settings/administrators');
      } else {
        toast({
          variant: "destructive",
          title: "สร้างไม่สำเร็จ",
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="mx-auto grid w-full max-w-2xl gap-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/settings/administrators">
              <ArrowLeftCircle className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold">เพิ่มผู้ดูแลระบบ</h1>
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลผู้ดูแลระบบใหม่</CardTitle>
            <CardDescription>
              สร้างบัญชีสำหรับเจ้าหน้าที่ Lawslane (เฉพาะ @lawslane.com)
            </CardDescription>
          </CardHeader>
          <form action={handleSubmit}>
            <CardContent className="grid gap-6">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 flex gap-3">
                <ShieldAlert className="h-5 w-5 text-yellow-600" />
                <div className="text-sm text-yellow-700">
                  <p className="font-semibold">ข้อจำกัดความปลอดภัย</p>
                  <p>อีเมลต้องลงท้ายด้วย <strong>@lawslane.com</strong> เท่านั้น (ยกเว้น lek.26015@gmail.com)</p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="name">ชื่อ-นามสกุล</Label>
                <Input id="name" name="name" placeholder="สมชาย ใจดี" required />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">อีเมล (@lawslane.com)</Label>
                <Input id="email" name="email" type="email" placeholder="name@lawslane.com" required />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <Input id="password" name="password" type="password" required minLength={6} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="role">ระดับสิทธิ์</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">ผู้ดูแลทั่วไป (Admin)</SelectItem>
                    <SelectItem value="super_admin">ผู้ดูแลสูงสุด (Super Admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t p-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                สร้างบัญชี
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}
