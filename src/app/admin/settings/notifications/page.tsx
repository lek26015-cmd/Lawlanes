
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function AdminSettingsNotificationsPage() {

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
                <p className="text-muted-foreground">จัดการการตั้งค่าทั่วไปของแพลตฟอร์ม Lawlanes</p>
            </div>
            <div className="mx-auto grid w-full max-w-4xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
                <nav
                    className="grid gap-4 text-sm text-muted-foreground"
                >
                    <Link href="/admin/settings">ทั่วไป</Link>
                    <Link href="/admin/settings/financials">การเงิน</Link>
                    <Link href="/admin/settings/administrators">ผู้ดูแลระบบ</Link>
                    <Link href="/admin/settings/notifications" className="font-semibold text-primary">การแจ้งเตือน</Link>
                </nav>
                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>การแจ้งเตือนทางอีเมล</CardTitle>
                            <CardDescription>
                                จัดการการส่งอีเมลแจ้งเตือนไปยังผู้ใช้และผู้ดูแลระบบ
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="flex items-center justify-between space-x-2">
                                <Label htmlFor="email-new-user" className="flex flex-col space-y-1">
                                    <span>ผู้ใช้ใหม่ลงทะเบียน</span>
                                    <span className="font-normal leading-snug text-muted-foreground">
                                        ส่งอีเมลแจ้งเตือนเมื่อมีผู้ใช้ใหม่สมัครสมาชิก
                                    </span>
                                </Label>
                                <Switch id="email-new-user" defaultChecked />
                            </div>
                            <div className="flex items-center justify-between space-x-2">
                                <Label htmlFor="email-new-ticket" className="flex flex-col space-y-1">
                                    <span>Ticket ใหม่</span>
                                    <span className="font-normal leading-snug text-muted-foreground">
                                        ส่งอีเมลแจ้งเตือนเมื่อมีการแจ้งปัญหาเข้ามาใหม่
                                    </span>
                                </Label>
                                <Switch id="email-new-ticket" defaultChecked />
                            </div>
                            <div className="flex items-center justify-between space-x-2">
                                <Label htmlFor="email-payment" className="flex flex-col space-y-1">
                                    <span>การชำระเงิน</span>
                                    <span className="font-normal leading-snug text-muted-foreground">
                                        ส่งอีเมลแจ้งเตือนเมื่อมีการชำระเงินสำเร็จ
                                    </span>
                                </Label>
                                <Switch id="email-payment" defaultChecked />
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
