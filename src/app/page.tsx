'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, MessageSquare, Users, Sparkles, Scale, ArrowRight, Newspaper, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getApprovedLawyers } from '@/lib/data';
import LawyerCard from '@/components/lawyer-card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { LawyerProfile } from '@/lib/types';
import { findLawyerSpecialties } from '@/ai/flows/find-lawyers-flow';
import ChatModal from '@/components/chat/chat-modal';

export default function Home() {
  const router = useRouter();
  const [features] = useState([
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
  ]);
  
  const [recommendedLawyers, setRecommendedLawyers] = useState<LawyerProfile[]>([]);
  const [articles] = useState([
    {
      id: 'article-1',
      title: '5 สิ่งต้องรู้ก่อนเซ็นสัญญาจ้างงาน',
      description: 'สัญญาจ้างงานเป็นเอกสารสำคัญที่มีผลผูกพันทางกฎหมายระหว่างนายจ้างและลูกจ้าง การทำความเข้าใจ...',
      imageUrl: PlaceHolderImages.find(img => img.id === 'article-1')?.imageUrl ?? '',
      imageHint: 'contract document',
    },
    {
      id: 'article-2',
      title: 'กฎหมาย PDPA สำหรับ SME ที่ต้องรู้',
      description: 'PDPA หรือ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล มีผลบังคับใช้แล้ว ธุรกิจ SME ต้องปรับตัวอย่างไรบ้าง...',
      imageHint: 'data privacy',
      imageUrl: PlaceHolderImages.find(img => img.id === 'article-2')?.imageUrl ?? '',
    },
    {
      id: 'article-3',
      title: 'การจดทะเบียนเครื่องหมายการค้า สำคัญอย่างไร?',
      description: 'เครื่องหมายการค้าเปรียบเสมือนหน้าตาของธุรกิจ การจดทะเบียนจึงเป็นสิ่งสำคัญเพื่อป้องกันการลอกเลียนแบบ...',
      imageHint: 'trademark logo',
      imageUrl: PlaceHolderImages.find(img => img.id === 'article-3')?.imageUrl ?? '',
    }
  ]);
  
  const [isFindingLawyers, setIsFindingLawyers] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState('');

  useEffect(() => {
    async function fetchLawyers() {
      const lawyers = await getApprovedLawyers();
      setRecommendedLawyers(lawyers.slice(0, 3));
    }
    fetchLawyers();
  }, []);

  const handleAnalysis = async () => {
    if (!analysisText.trim()) return;
    setIsFindingLawyers(true);
    try {
      const result = await findLawyerSpecialties({ problem: analysisText });
      const specialtiesQuery = result.specialties.join(',');
      router.push(`/lawyers?specialties=${specialtiesQuery}`);
    } catch (error) {
      console.error('Error finding lawyer specialties:', error);
      router.push('/lawyers');
    } finally {
      setIsFindingLawyers(false);
    }
  };
  
  const handleCardClick = () => {
      if (analysisText) {
          setInitialPrompt(analysisText);
      }
      setIsChatOpen(true);
  }
  
  const clearInitialPrompt = () => {
    setInitialPrompt('');
  }


  return (
    <>
      <div className="flex flex-col">
      <section className="w-full py-20 md:py-32 lg:py-40 bg-background text-foreground">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
                        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline">
                            ค้นหาทนายความ...
                            <br />
                            <span className="opacity-90">ที่ใช่สำหรับคุณ</span>
                        </h1>
                        <p className="max-w-[600px] text-foreground/80 md:text-xl">
                            Lawlane คือตลาดกลางทนายความออนไลน์ ที่เชื่อมต่อคุณกับผู้เชี่ยวชาญกฎหมายทั่วประเทศได้อย่างมั่นใจ
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link href="/lawyers">
                            <Button size="lg" variant="secondary">ดูรายชื่อทนายทั้งหมด</Button>
                            </Link>
                            <Link href="#features">
                            <Button size="lg" variant="outline">
                                บริการของเรา
                            </Button>
                            </Link>
                        </div>
                    </div>

                    <Card className="p-6 md:p-8 shadow-xl bg-primary text-primary-foreground">
                        <div className="absolute top-4 right-4 bg-secondary text-primary-foreground p-3 rounded-full shadow-lg">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                            <Scale className="h-7 w-7 text-primary-foreground" />
                            <h2 className="text-2xl md:text-3xl font-bold font-headline">
                            ไม่แน่ใจว่าต้องการทนายด้านไหน?
                            </h2>
                        </div>
                        <p className="text-primary-foreground/80 mb-6">
                            ให้ AI ช่วยวิเคราะห์ปัญหาเบื้องต้นและแนะนำทนายที่ตรงจุดให้คุณ
                        </p>
                        <div className="space-y-4">
                            <Textarea
                              value={analysisText}
                              onChange={(e) => setAnalysisText(e.target.value)}
                              placeholder='อธิบายปัญหาของคุณที่นี่ เช่น "โดนโกงแชร์", "ต้องการจดทะเบียนบริษัท", "ปัญหาที่ดินกับเพื่อนบ้าน"'
                              rows={4}
                              className="bg-background/20 text-primary-foreground placeholder:text-primary-foreground/60"
                            />
                            <Button size="lg" className="w-full" onClick={handleAnalysis} disabled={isFindingLawyers} variant="secondary">
                              {isFindingLawyers ? (
                                  <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  กำลังวิเคราะห์...
                                  </>
                              ) : (
                                  'วิเคราะห์และแนะนำทนาย'
                              )}
                            </Button>
                        </div>
                    </Card>
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
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">
                ทนายที่แนะนำ
              </h2>
              <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
                ทนายความผู้เชี่ยวชาญที่คัดสรรมาเพื่อธุรกิจ SME โดยเฉพาะ
              </p>
            </div>
            <div className="flex flex-col gap-4">
                {recommendedLawyers.map((lawyer) => (
                  <div key={lawyer.id} className="border-b border-border">
                    <LawyerCard lawyer={lawyer} />
                  </div>
                ))}
            </div>
            <div className="text-center mt-12">
              <Link href="/lawyers">
                  <Button variant="outline">
                      ดูทนายทั้งหมด <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
              </Link>
            </div>
          </div>
        </section>

        <section id="articles" className="w-full py-12 md:py-24 lg:py-32 bg-secondary/20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">
                บทความกฎหมายน่ารู้
              </h2>
              <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
                อัปเดตความรู้ทางกฎหมายสำหรับธุรกิจของคุณ
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {articles.map((article) => (
                <Card key={article.id} className="overflow-hidden h-full flex flex-col">
                  <Link href="#" className="block">
                    <div className="relative h-48 w-full">
                      <Image
                        src={article.imageUrl}
                        alt={article.title}
                        fill
                        className="object-cover"
                        data-ai-hint={article.imageHint}
                      />
                    </div>
                  </Link>
                  <CardHeader>
                    <CardTitle>
                      <Link href="#" className="hover:text-primary transition-colors">
                        {article.title}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <CardDescription>{article.description}</CardDescription>
                  </CardContent>
                  <div className="p-6 pt-0">
                    <Link href="#">
                      <Button variant="link" className="p-0">
                        อ่านต่อ <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
            <div className="text-center mt-12">
              <Link href="#">
                  <Button variant="outline">
                      ดูบทความทั้งหมด <Newspaper className="ml-2 h-4 w-4" />
                  </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
      <ChatModal isOpen={isChatOpen} onOpenChange={setIsChatOpen} initialPrompt={initialPrompt} clearInitialPrompt={clearInitialPrompt} />
    </>
  );
}
