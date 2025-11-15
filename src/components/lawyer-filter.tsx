
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Scale } from 'lucide-react';

export default function LawyerFilterSidebar() {
  const specialties = ['คดีฉ้อโกง SMEs', 'คดีแพ่งและพาณิชย์', 'การผิดสัญญา'];
  const provinces = ['กรุงเทพมหานคร', 'เชียงใหม่', 'ภูเก็ต', 'ขอนแก่น', 'ชลบุรี'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>ตัวกรองการค้นหา</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="specialty">ความเชี่ยวชาญ</Label>
          <Select>
            <SelectTrigger id="specialty">
              <SelectValue placeholder="ทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              {specialties.map((spec) => (
                <SelectItem key={spec} value={spec}>
                  {spec}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>คะแนนรีวิวขั้นต่ำ</Label>
          <RadioGroup defaultValue="all" className="space-y-2">
            {[4, 3, 2].map((rating) => (
              <div key={rating} className="flex items-center space-x-2">
                <RadioGroupItem value={String(rating)} id={`rating-${rating}`} />
                <Label htmlFor={`rating-${rating}`} className="flex items-center gap-1 font-normal">
                  {[...Array(5)].map((_, i) => (
                    <Scale key={i} className={`w-4 h-4 ${i < rating ? 'text-primary fill-primary/20' : 'text-muted-foreground'}`} />
                  ))}
                  ขึ้นไป
                </Label>
              </div>
            ))}
             <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="rating-all" />
                <Label htmlFor="rating-all" className="font-normal">ทั้งหมด</Label>
              </div>
          </RadioGroup>
        </div>
        <div className="space-y-2">
          <Label htmlFor="province">จังหวัด/พื้นที่ (จำลอง)</Label>
          <Select>
            <SelectTrigger id="province">
              <SelectValue placeholder="ทุกจังหวัด" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">ทุกจังหวัด</SelectItem>
              {provinces.map((prov) => (
                <SelectItem key={prov} value={prov}>
                  {prov}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">ค้นหาด้วยตัวกรอง</Button>
      </CardFooter>
    </Card>
  );
}

    