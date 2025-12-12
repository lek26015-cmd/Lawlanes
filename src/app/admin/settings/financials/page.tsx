
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function AdminFinancialSettingsPage() {

  const handleSaveChanges = () => {
    toast({
      title: 'บันทึกการตั้งค่าสำเร็จ',
      description: 'ระบบได้บันทึกการเปลี่ยนแปลงของคุณแล้ว'
    });
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="mx-auto grid w-full max-w-4xl gap-2">
        <h1 className="text-3xl font-semibold">ตั้งค่าระบบ</h1>
        <p className="text-muted-foreground">จัดการการตั้งค่าทั่วไปของแพลตฟอร์ม Lawslane</p>
      </div>
      <div className="mx-auto grid w-full max-w-4xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
        <nav
          className="grid gap-4 text-sm text-muted-foreground"
        >
          <Link href="/admin/settings">
            ทั่วไป
          </Link>
          <Link href="/admin/settings/financials" className="font-semibold text-primary">
            การเงิน
          </Link>
          <Link href="/admin/settings/administrators">ผู้ดูแลระบบ</Link>
          <Link href="/admin/settings/notifications">การแจ้งเตือน</Link>
        </nav>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>ค่าธรรมเนียมแพลตฟอร์ม</CardTitle>
              <CardDescription>
                กำหนดเปอร์เซ็นต์ส่วนแบ่งรายได้ที่แพลตฟอร์มจะได้รับจากค่าบริการ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4">
                <div className='relative'>
                  <Input placeholder="15" type="number" defaultValue="15" className="pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>รอบการจ่ายเงิน</CardTitle>
              <CardDescription>ตั้งค่ารอบการจ่ายเงินส่วนแบ่งให้ทนายความ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>ความถี่ในการจ่ายเงิน</Label>
                  <Select defaultValue="monthly">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">ทุกสัปดาห์</SelectItem>
                      <SelectItem value="bi-weekly">ทุก 2 สัปดาห์</SelectItem>
                      <SelectItem value="monthly">ทุกเดือน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>วันที่จ่ายเงิน (สำหรับรายเดือน)</Label>
                  <Input type="number" defaultValue="25" placeholder="เช่น 25 หมายถึงวันที่ 25 ของทุกเดือน" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button onClick={handleSaveChanges}>บันทึกการเปลี่ยนแปลง</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}
