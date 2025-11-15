import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, MessageSquare, Users, Sparkles, Scale } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  const features = [
    {
      icon: <MessageSquare className="h-8 w-8 text-primary" />,
      title: 'AI Legal Advisor',
      description: 'รับการประเมินปัญหาทางกฎหมายเบื้องต้นได้ทันที',
    },
    {
      icon: <Users className="h-8 w-8 text-primary" />,
      title: 'Expert Lawyer Marketplace',
      description: 'เชื่อมต่อกับทนายความผู้เชี่ยวชาญที่ผ่านการคัดเลือก',
    },
    {
      icon: <CheckCircle className="h-8 w-8 text-primary" />,
      title: 'Streamlined Case Hand-off',
      description: 'ให้ AI ช่วยแนะนำและส่งต่อเคสของคุณไปยังทนายที่เหมาะสม',
    },
  ];

  return (
    <div className="flex flex-col">
      <section className="w-full pt-12 pb-20 md:pt-24 md:pb-32 lg:pt-32 lg:pb-40 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background z-0"></div>
        <div 
            className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full filter blur-3xl opacity-30 animate-pulse"
            style={{ animationDuration: '8s' }}>
        </div>
        <div 
            className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-accent/5 rounded-full filter blur-3xl opacity-20 animate-pulse"
            style={{ animationDuration: '10s', animationDelay: '2s' }}>
        </div>

        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col items-start space-y-6 text-left">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline text-primary">
                ค้นหาทนายความ...
                <br />
                <span className="text-foreground">ที่ใช่สำหรับคุณ</span>
              </h1>
              <p className="max-w-[600px] text-muted-foreground md:text-xl">
                Lawlane คือตลาดกลางทนายความออนไลน์ ที่เชื่อมต่อคุณกับผู้เชี่ยวชาญกฎหมายทั่วประเทศได้อย่างมั่นใจ
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <Link href="/lawyers">
                  <Button size="lg">ดูรายชื่อทนายทั้งหมด</Button>
                </Link>
                <Link href="#features">
                  <Button size="lg" variant="outline">
                    บริการของเรา
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative p-8 bg-card/50 rounded-2xl shadow-lg border border-border/50 backdrop-blur-sm">
                <div className="absolute top-0 right-0 -mt-4 -mr-4">
                    <div className="flex items-center justify-center bg-primary text-primary-foreground rounded-full w-20 h-20 shadow-md">
                        <Sparkles className="w-10 h-10" />
                    </div>
                </div>
                <CardHeader className="p-0 mb-4">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Scale className="text-primary"/>
                        ไม่แน่ใจว่าต้องการทนายด้านไหน?
                    </CardTitle>
                    <CardDescription className="pt-2 text-base">
                        ให้ AI ช่วยวิเคราะห์ปัญหาเบื้องต้นและแนะนำทนายที่ตรงจุดให้คุณ
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex flex-col gap-4">
                        <Textarea
                            placeholder='อธิบายปัญหาของคุณที่นี่ เช่น "โดนโกงแชร์", "ต้องการจดทะเบียนบริษัท", "ปัญหาที่ดินกับเพื่อนบ้าน"'
                            rows={4}
                            className="bg-background"
                        />
                        <Button className="w-full" size="lg">
                           วิเคราะห์และแนะนำทนาย
                        </Button>
                    </div>
                </CardContent>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="w-full py-12 md:py-24 lg:py-20 bg-secondary/20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">How Lawlane Works</h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                A simple, three-step process to get legal clarity for your business.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3 lg:max-w-none mt-12">
            {features.map((feature, index) => (
              <Card key={index} className="h-full bg-card/80 backdrop-blur-sm hover:shadow-lg transition-shadow duration-300 border-border/50">
                <CardHeader className="flex flex-col items-center text-center">
                  {feature.icon}
                  <CardTitle className="mt-4 text-lg font-semibold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container mx-auto grid items-center justify-center gap-4 px-4 text-center md:px-6">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight font-headline">
              Ready to find your legal solution?
            </h2>
            <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Explore our marketplace of expert lawyers, hand-picked for their experience with SME cases.
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm space-y-2">
            <Link href="/lawyers">
              <Button size="lg" className="w-full">
                View Lawyers
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
