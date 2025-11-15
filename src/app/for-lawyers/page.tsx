'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import Link from 'next/link';

export default function ForLawyersPage() {
  const benefits = [
    {
      icon: <Check className="text-green-500" />,
      text: 'เข้าถึงกลุ่มลูกค้า SME และบุคคลทั่วไปที่ต้องการความช่วยเหลือทางกฎหมาย',
    },
    {
      icon: <Check className="text-green-500" />,
      text: 'ระบบจัดการเคสและนัดหมายออนไลน์ที่ใช้งานง่าย',
    },
    {
      icon: <Check className="text-green-500" />,
      text: 'เพิ่มความน่าเชื่อถือและสร้างโปรไฟล์ chuyên nghiệp ของคุณ',
    },
    {
      icon: <Check className="text-green-500" />,
      text: 'มีทีมงานคอยให้ความช่วยเหลือและสนับสนุน',
    },
  ];

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground font-headline">
              เข้าร่วมเป็นส่วนหนึ่งของ Lawlane
            </h1>
            <p className="text-lg text-muted-foreground">
              ขยายฐานลูกค้าและพัฒนาการทำงานของคุณไปกับแพลตฟอร์มกฎหมายสำหรับยุคดิจิทัล
              เรากำลังมองหาทนายความผู้มีความสามารถและมุ่งมั่นที่จะมอบบริการที่ดีที่สุดเพื่อเข้าร่วมเครือข่ายของเรา
            </p>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0">{benefit.icon}</div>
                  <p className="text-foreground/90">{benefit.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-center text-2xl font-headline">
                  พร้อมที่จะเติบโตไปกับเราแล้วหรือยัง?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-6">
                  สมัครเข้าร่วมเป็นทนายความในเครือข่าย Lawlane ได้ง่ายๆ
                  เพียงไม่กี่ขั้นตอน
                </p>
                <Button asChild size="lg" className="w-full">
                  <Link href="/lawyer-signup">สมัครเข้าร่วมทันที</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
