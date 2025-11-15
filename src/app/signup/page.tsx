'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';

export default function LawyerSignupPage() {
  const { toast } = useToast();
  const [profilePic, setProfilePic] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfilePic(file);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Form submission logic would go here
    toast({
      title: "ส่งใบสมัครเรียบร้อย",
      description: "ทีมงานจะตรวจสอบข้อมูลและติดต่อกลับโดยเร็วที่สุด ขอบคุณครับ/ค่ะ",
    });
  };
  
  const specialties = ['คดีฉ้อโกง SMEs', 'คดีแพ่งและพาณิชย์', 'การผิดสัญญา', 'ทรัพย์สินทางปัญญา', 'กฎหมายแรงงาน'];


  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader className="text-center">
                <UserPlus className="w-12 h-12 mx-auto text-foreground" />
                <CardTitle className="text-3xl font-bold font-headline mt-2">สมัครเป็นทนายความ Lawlane</CardTitle>
                <CardDescription>กรอกข้อมูลเพื่อเข้าร่วมเครือข่ายทนายความคุณภาพกับเรา</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Profile Picture Upload */}
                    <div className="flex flex-col items-center gap-4">
                         <div className="relative w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                           {profilePic ? (
                                <img src={URL.createObjectURL(profilePic)} alt="Profile Preview" className="w-full h-full object-cover" />
                           ) : (
                                <Upload className="w-8 h-8 text-gray-400" />
                           )}
                         </div>
                         <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('profile-pic-upload')?.click()}>
                            เลือกรูปโปรไฟล์
                         </Button>
                         <Input id="profile-pic-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="full-name">ชื่อ-นามสกุล</Label>
                            <Input id="full-name" placeholder="สมชาย กฎหมายดี" required />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="license-number">เลขที่ใบอนุญาตว่าความ</Label>
                            <Input id="license-number" placeholder="12345/2550" required />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="email">อีเมล</Label>
                        <Input id="email" type="email" placeholder="somchai@example.com" required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">รหัสผ่าน</Label>
                            <Input id="password" type="password" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">ยืนยันรหัสผ่าน</Label>
                            <Input id="confirm-password" type="password" required />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <Label>ความเชี่ยวชาญ (เลือกได้มากกว่า 1 ข้อ)</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {specialties.map(spec => (
                                <div key={spec} className="flex items-center space-x-2 p-2 rounded-md bg-secondary/50">
                                    <Checkbox id={`spec-${spec}`} />
                                    <Label htmlFor={`spec-${spec}`} className="text-sm font-normal">{spec}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">แนะนำตัวเองสั้นๆ (สำหรับหน้าโปรไฟล์)</Label>
                        <Textarea id="description" placeholder="บอกเล่าประสบการณ์และความเชี่ยวชาญของคุณ..." rows={4} required/>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="terms" required/>
                        <Label htmlFor="terms" className="text-sm font-normal">
                           ฉันยอมรับ <Link href="/terms" className="underline hover:text-primary">ข้อกำหนดและเงื่อนไข</Link> และ <Link href="/privacy" className="underline hover:text-primary">นโยบายความเป็นส่วนตัว</Link> ของ Lawlane
                        </Label>
                    </div>

                    <Button type="submit" className="w-full" size="lg">ส่งใบสมัคร</Button>
                </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
