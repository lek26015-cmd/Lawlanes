import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Gavel, MessageSquare, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  const features = [
    {
      icon: <MessageSquare className="h-10 w-10 text-primary" />,
      title: 'AI Legal Advisor',
      description: 'Get instant, preliminary assessments for your legal questions regarding civil and commercial law.',
    },
    {
      icon: <Users className="h-10 w-10 text-primary" />,
      title: 'Expert Lawyer Marketplace',
      description: 'Connect with a curated list of specialized lawyers for complex cases requiring professional handling.',
    },
    {
      icon: <CheckCircle className="h-10 w-10 text-primary" />,
      title: 'Streamlined Case Hand-off',
      description: 'Our AI seamlessly determines if you need a lawyer and facilitates the connection process.',
    },
  ];

  return (
    <div className="flex flex-col">
      <section className="w-full py-20 md:py-32 lg:py-40 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <div className="flex flex-col items-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline">
              ค้นหาทนายความ... ที่ใช่สำหรับคุณ
            </h1>
            <p className="max-w-[700px] text-primary-foreground/80 md:text-xl">
              Lawlane คือตลาดกลางทนายความออนไลน์ที่เชื่อมต่อคุณกับผู้เชี่ยวชาญกฎหมายทั่วประเทศ
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <Link href="/lawyers">
                <Button size="lg" variant="secondary">ดูรายชื่อทนายทั้งหมด</Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary">ดูบริการของเรา</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full -mt-20">
        <div className="container mx-auto px-4 md:px-6">
            <Card className="max-w-3xl mx-auto shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle>ไม่แน่ใจว่าต้องการทนายด้านไหน?</CardTitle>
                    <CardContent className="text-muted-foreground pt-2">ให้ AI ช่วยวิเคราะห์ปัญหาเบื้องต้นและแนะนำทนายที่ตรงจุด</CardContent>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4">
                        <Textarea 
                            placeholder='อธิบายปัญหาของคุณที่นี่ เช่น "โดนโกงแชร์", "ต้องการจดทะเบียนบริษัท", "ปัญหาที่ดินกับเพื่อนบ้าน"'
                            rows={3}
                        />
                        <Button className="w-full">
                           วิเคราะห์และแนะนำทนายความ
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      </section>
      
      <section id="features" className="w-full py-12 md:py-24 lg:py-32">
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
              <Card key={index} className="h-full">
                <CardHeader className="flex flex-col items-center text-center">
                  {feature.icon}
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32 bg-card/50">
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
