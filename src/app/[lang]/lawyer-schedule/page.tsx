
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Clock, Calendar as CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export default function LawyerSchedulePage() {
  const { toast } = useToast();
  const [workingHours, setWorkingHours] = useState({ start: '09:00', end: '18:00' });
  const [availableDays, setAvailableDays] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  });
  const [overrideDate, setOverrideDate] = useState<Date | undefined>();
  const [overrideReason, setOverrideReason] = useState('');
  const [overrides, setOverrides] = useState<{ date: Date; reason: string }[]>([]);

  const dayLabels: { [key in DayOfWeek]: string } = {
    monday: 'วันจันทร์',
    tuesday: 'วันอังคาร',
    wednesday: 'วันพุธ',
    thursday: 'วันพฤหัสบดี',
    friday: 'วันศุกร์',
    saturday: 'วันเสาร์',
    sunday: 'วันอาทิตย์',
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return [`${hour}:00`, `${hour}:30`];
  }).flat();

  const handleDayToggle = (day: DayOfWeek) => {
    setAvailableDays(prev => ({ ...prev, [day]: !prev[day] }));
  };
  
  const handleAddOverride = () => {
    if (overrideDate && overrideReason) {
        if (overrides.find(ov => ov.date.toDateString() === overrideDate.toDateString())) {
            toast({ variant: 'destructive', title: "วันที่นี้ถูกเพิ่มไปแล้ว" });
            return;
        }
        setOverrides([...overrides, { date: overrideDate, reason: overrideReason }]);
        setOverrideDate(undefined);
        setOverrideReason('');
    } else {
        toast({ variant: 'destructive', title: "ข้อมูลไม่ครบถ้วน", description: "กรุณาเลือกวันที่และใส่เหตุผล" });
    }
  }

  const handleSaveChanges = () => {
    console.log({ workingHours, availableDays, overrides });
    toast({
      title: "บันทึกข้อมูลสำเร็จ",
      description: "ตารางเวลาของคุณได้รับการอัปเดตแล้ว",
    });
  };

  return (
    <div className="bg-gray-100/50 min-h-screen">
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <Link href="/lawyer-dashboard" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              กลับไปที่แดชบอร์ด
            </Link>
            <h1 className="text-3xl font-bold font-headline">จัดการตารางนัดหมาย</h1>
            <p className="text-muted-foreground">ตั้งค่าเวลาทำงาน วันหยุด และจัดการการนัดหมายของคุณ</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock /> เวลาทำงานปกติ</CardTitle>
              <CardDescription>กำหนดช่วงเวลาที่คุณรับนัดหมายในแต่ละวัน</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="start-time">เวลาเริ่มต้น</Label>
                <Select value={workingHours.start} onValueChange={(value) => setWorkingHours(prev => ({...prev, start: value}))}>
                  <SelectTrigger id="start-time"><SelectValue /></SelectTrigger>
                  <SelectContent>{timeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">เวลาสิ้นสุด</Label>
                 <Select value={workingHours.end} onValueChange={(value) => setWorkingHours(prev => ({...prev, end: value}))}>
                  <SelectTrigger id="end-time"><SelectValue /></SelectTrigger>
                  <SelectContent>{timeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><CalendarIcon /> วันที่เปิดรับงาน</CardTitle>
                <CardDescription>เลือกวันที่คุณต้องการเปิดรับการนัดหมายในสัปดาห์</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.keys(availableDays).map((day) => (
                    <div key={day} className="flex items-center justify-between p-3 border rounded-lg bg-secondary/30">
                        <Label htmlFor={day} className="font-medium">{dayLabels[day as DayOfWeek]}</Label>
                        <Switch id={day} checked={availableDays[day as DayOfWeek]} onCheckedChange={() => handleDayToggle(day as DayOfWeek)} />
                    </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><CalendarIcon /> เพิ่มวันหยุดพิเศษ</CardTitle>
                <CardDescription>ระบุวันที่คุณไม่สะดวกรับงานเพิ่มเติม เช่น วันหยุดพักผ่อน หรือไปทำธุระ</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                    <Calendar
                        mode="single"
                        selected={overrideDate}
                        onSelect={setOverrideDate}
                        disabled={(date) => date < new Date() }
                        className="rounded-md border self-center"
                    />
                    <Input 
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="เหตุผล (เช่น ลาพักร้อน, มีงานนอกแพลตฟอร์ม)"
                    />
                    <Button onClick={handleAddOverride}><PlusCircle/> เพิ่มวันหยุด</Button>
                </div>
                <div className="space-y-3">
                    <h4 className="font-medium">รายการวันหยุดที่เพิ่ม</h4>
                    <div className="space-y-2 p-3 rounded-md bg-gray-100 min-h-48">
                    {overrides.length > 0 ? overrides.map(ov => (
                        <div key={ov.date.toString()} className="flex justify-between items-center bg-white p-2 rounded-md border">
                            <div>
                                <p className="font-semibold">{ov.date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric'})}</p>
                                <p className="text-sm text-muted-foreground">{ov.reason}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setOverrides(overrides.filter(o => o.date !== ov.date))}>
                                <Trash2 className="w-4 h-4 text-destructive"/>
                            </Button>
                        </div>
                    )) : (
                        <p className="text-sm text-muted-foreground text-center pt-4">ยังไม่มีวันหยุดพิเศษ</p>
                    )}
                    </div>
                </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button size="lg" onClick={handleSaveChanges}>บันทึกการเปลี่ยนแปลงทั้งหมด</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
