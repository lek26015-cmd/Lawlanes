'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, User, Lock, Bell, ShieldAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


export default function AccountPage() {
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  return (
    <div className="bg-gray-100/50">
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                กลับไปที่แดชบอร์ด
            </Link>
            <h1 className="text-3xl font-bold font-headline">จัดการบัญชี</h1>
            <p className="text-muted-foreground">อัปเดตข้อมูลโปรไฟล์และตั้งค่าบัญชีของคุณ</p>
          </div>

          {/* Profile Information */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <User className="w-6 h-6" />
                <div>
                  <CardTitle>ข้อมูลโปรไฟล์</CardTitle>
                  <CardDescription>นี่คือข้อมูลสาธารณะของคุณ</CardDescription>
                </div>
              </div>
               <Button variant="outline" size="sm" onClick={() => setIsEditingProfile(!isEditingProfile)}>
                {isEditingProfile ? 'ยกเลิก' : 'แก้ไข'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                    <Avatar className="w-20 h-20">
                        <AvatarImage src="https://picsum.photos/seed/user-avatar/100/100" />
                        <AvatarFallback>สใ</AvatarFallback>
                    </Avatar>
                    {isEditingProfile && <Button variant="outline">เปลี่ยนรูปภาพ</Button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">ชื่อ-นามสกุล</Label>
                        <Input id="name" defaultValue="สมหญิง ใจดี" disabled={!isEditingProfile} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">อีเมล</Label>
                        <Input id="email" type="email" defaultValue="somying@example.com" disabled />
                    </div>
                </div>
            </CardContent>
            {isEditingProfile && (
                <CardFooter>
                    <Button onClick={() => setIsEditingProfile(false)}>บันทึกการเปลี่ยนแปลง</Button>
                </CardFooter>
            )}
          </Card>

           {/* Password Settings */}
          <Card>
            <CardHeader className="flex items-center gap-4">
               <Lock className="w-6 h-6" />
               <div>
                <CardTitle>ความปลอดภัย</CardTitle>
                <CardDescription>เปลี่ยนรหัสผ่านของคุณ</CardDescription>
               </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">รหัสผ่านปัจจุบัน</Label>
                <Input id="current-password" type="password" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
                    <Input id="new-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
              </div>
            </CardContent>
             <CardFooter>
                <Button>เปลี่ยนรหัสผ่าน</Button>
            </CardFooter>
          </Card>
          
          {/* Notifications */}
          <Card>
            <CardHeader className="flex items-center gap-4">
                <Bell className="w-6 h-6" />
                <div>
                  <CardTitle>การแจ้งเตือน</CardTitle>
                  <CardDescription>จัดการการตั้งค่าการแจ้งเตือนของคุณ</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                    <Label htmlFor="newsletter" className="font-medium">การแจ้งเตือนทางอีเมล</Label>
                    <p className="text-sm text-muted-foreground">รับข่าวสาร, อัปเดต และเคล็ดลับทางกฎหมาย</p>
                </div>
                <Switch id="newsletter" defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
             <CardHeader className="flex items-center gap-4">
               <ShieldAlert className="w-6 h-6 text-destructive" />
               <div>
                <CardTitle className="text-destructive">โซนอันตราย</CardTitle>
                <CardDescription>การดำเนินการเหล่านี้ไม่สามารถย้อนกลับได้</CardDescription>
               </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                <div>
                    <p className="font-semibold">ลบบัญชี</p>
                    <p className="text-sm text-muted-foreground">ข้อมูลทั้งหมดของคุณจะถูกลบอย่างถาวร</p>
                </div>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">ลบบัญชีของฉัน</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>คุณแน่ใจหรือไม่?</AlertDialogTitle>
                        <AlertDialogDescription>
                           การกระทำนี้ไม่สามารถย้อนกลับได้ บัญชีและข้อมูลทั้งหมดของคุณจะถูกลบอย่างถาวร
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">ยืนยันการลบ</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
