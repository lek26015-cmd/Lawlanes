'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, MessageSquare, Users, Sparkles, Scale, ArrowRight, Newspaper, Loader2, Briefcase, UserCheck, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getApprovedLawyers, getAllArticles } from '@/lib/data';
import LawyerCard from '@/components/lawyer-card';
import type { LawyerProfile, Article } from '@/lib/types';
import { findLawyerSpecialties } from '@/ai/flows/find-lawyers-flow';
import { useChat } from '@/context/chat-context';

export default function Home() {
  const router = useRouter();
  const [features] = useState([
    {
      icon: <MessageSquare className="h-8 w-8 text-foreground" />,
      title: 'AI Legal Advisor',
      description: 'รับการประเมินปัญหาทางกฎหมายเบื้องต้นได้ทันที',
    },
    {
      icon: <Users className="h-8 w-8 text-foreground" />,
      title: 'Expert Lawyer Marketplace',
      description: 'เชื่อมต่อกับทนายความผู้เชี่ยวชาญที่ผ่านการคัดเลือก',
    },
    {
      icon: <CheckCircle className="h-8 w-8 text-foreground" />,
      title: 'Streamlined Case Hand-off',
      description: 'ให้ AI ช่วยแนะนำและส่งต่อเคสของคุณไปยังทนายที่เหมาะสม',
    },
  ]);
  
  const [recommendedLawyers, setRecommendedLawyers] = useState<LawyerProfile[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  
  const [isFindingLawyers, setIsFindingLawyers] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const { setAiChatOpen, setInitialPrompt } = useChat();

  useEffect(() => {
    async function fetchData() {
      const lawyers = await getApprovedLawyers();
      setRecommendedLawyers(lawyers.slice(0, 3));
      const allArticles = await getAllArticles();
      setArticles(allArticles);
    }
    fetchData();
  }, []);

  const handleAnalysis = async () => {
    if (!analysisText.trim()) return;
    
    setInitialPrompt(analysisText);
    setAiChatOpen(true);
  };
  
  return (
    <>
      <div className="flex flex-col">
      <section className="w-full py-20 md:py-32 lg:py-40 bg-foreground text-background">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
                        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline">
                            ค้นหาทนายความ...
                            <br />
                            <span className="opacity-90">ที่ใช่สำหรับคุณ</span>
                        </h1>
                        <p className="max-w-[600px] text-background/80 md:text-xl">
                            Lawlane คือตลาดกลางทนายความออนไลน์ ที่เชื่อมต่อคุณกับผู้เชี่ยวชาญกฎหมายทั่วประเทศได้อย่างมั่นใจ
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link href="/lawyers">
                            <Button size="lg" variant="secondary">ดูรายชื่อทนายทั้งหมด</Button>
                            </Link>
                            <Link href="#features">
                            <Button size="lg" variant="outline" className="bg-transparent text-background border-background hover:bg-background hover:text-foreground">
                                บริการของเรา
                            </Button>
                            </Link>
                        </div>
                    </div>

                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-rainbow-border-spin"></div>
                        <Card className="relative p-6 md:p-8 shadow-xl bg-primary text-primary-foreground rounded-2xl">
                            <div className="absolute top-4 right-4 bg-foreground text-background p-3 rounded-full shadow-lg">
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
                                  className="bg-gray-100 text-primary-foreground placeholder:text-primary-foreground/60"
                                />
                                <Button size="lg" className="w-full bg-foreground text-background hover:bg-foreground/90" onClick={handleAnalysis} disabled={isFindingLawyers}>
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
            </div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-20 bg-primary text-primary-foreground">
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
                <Card key={index} className="h-full bg-primary hover:shadow-lg transition-shadow duration-300 border-gray-200 rounded-2xl">
                  <CardHeader className="flex flex-col items-center text-center">
                    {React.cloneElement(feature.icon, { className: "h-8 w-8 text-foreground" })}
                    <CardTitle className="mt-4 text-lg font-semibold text-foreground">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-50">
          <div className="container mx-auto px-4 md:px-6">
            
            <div className="mb-16">
                 <Card className="bg-blue-50 border-blue-200">
                    <div className="flex flex-col md:flex-row items-center justify-between p-8 gap-6">
                        <div className="flex items-center gap-4">
                            <ShieldCheck className="w-10 h-10 text-blue-600 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-xl text-blue-900">ตรวจสอบสถานะทนายความ</h3>
                                <p className="text-blue-800/90">สร้างความมั่นใจก่อนเริ่มจ้างงาน ด้วยการตรวจสอบข้อมูลใบอนุญาตว่าความ</p>
                            </div>
                        </div>
                        <Link href="/verify-lawyer" className="w-full md:w-auto">
                            <Button className="bg-foreground text-background hover:bg-foreground/90 w-full">
                                ตรวจสอบเลย
                            </Button>
                        </Link>
                    </div>
                 </Card>
            </div>

            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline text-foreground">
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

        <section className="w-full py-12 md:py-24 lg:py-32 bg-foreground text-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
                <div className="inline-block bg-background text-foreground p-3 rounded-full mb-4">
                    <Briefcase className="h-8 w-8" />
                </div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">
                คุณเป็นทนายความใช่ไหม?
              </h2>
              <p className="max-w-3xl mx-auto mt-4 text-background/80 md:text-xl">
                เข้าร่วมเครือข่ายทนายความคุณภาพของเราเพื่อเข้าถึงลูกค้ากลุ่มใหม่ๆ และใช้เครื่องมือที่ทันสมัยในการจัดการเคสของคุณ
              </p>
              <div className="mt-8">
                <Link href="/for-lawyers">
                    <Button size="lg" variant="secondary" className="text-lg">
                        <UserCheck className="mr-2 h-5 w-5" /> เข้าร่วมกับ Lawlane
                    </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="articles" className="w-full py-12 md:py-24 lg:py-32 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline text-foreground">
                บทความกฎหมายน่ารู้
              </h2>
              <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
                อัปเดตความรู้ทางกฎหมายสำหรับธุรกิจของคุณ
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {articles.map((article) => (
                <Card key={article.id} className="overflow-hidden h-full flex flex-col">
                  <Link href={`/articles/${article.slug}`} className="block">
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
                      <Link href={`/articles/${article.slug}`} className="hover:text-primary transition-colors">
                        {article.title}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <CardDescription>{article.description}</CardDescription>
                  </CardContent>
                  <div className="p-6 pt-0">
                    <Link href={`/articles/${article.slug}`}>
                      <Button variant="link" className="p-0 text-foreground">
                        อ่านต่อ <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
            <div className="text-center mt-12">
              <Link href="/articles">
                  <Button variant="outline">
                      ดูบทความทั้งหมด <Newspaper className="ml-2 h-4 w-4" />
                  </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
