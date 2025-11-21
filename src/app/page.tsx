

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, MessageSquare, Users, Sparkles, Scale, ArrowRight, Newspaper, Loader2, Briefcase, UserCheck, ShieldCheck, ShieldAlert, Phone, Mail, Award, FileText } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getApprovedLawyers, getAllArticles, getLawyerById, getAdsByPlacement, getImageUrl, getImageHint } from '@/lib/data';
import LawyerCard from '@/components/lawyer-card';
import type { LawyerProfile, Article, Ad, ImagePlaceholder } from '@/lib/types';
import { findLawyerSpecialties } from '@/ai/flows/find-lawyers-flow';
import { useChat } from '@/context/chat-context';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Logo from '@/components/logo';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Separator } from '@/components/ui/separator';
import Autoplay from "embla-carousel-autoplay";


export default function Home() {
  const router = useRouter();
  const [features] = useState([
    {
      icon: <MessageSquare className="w-6 h-6 text-blue-600" />,
      title: 'ที่ปรึกษากฎหมาย AI',
      description: 'รับการประเมินปัญหาทางกฎหมายเบื้องต้นได้ทันทีจาก AI ผู้เชี่ยวชาญของเรา',
    },
    {
      icon: <Users className="w-6 h-6 text-blue-600" />,
      title: 'ตลาดกลางทนายความ',
      description: 'เชื่อมต่อกับเครือข่ายทนายความที่ผ่านการคัดเลือกและเชี่ยวชาญเฉพาะทาง',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-blue-600" />,
      title: 'ปลอดภัยและเป็นความลับ',
      description: 'ข้อมูลและการสนทนาของคุณจะถูกเข้ารหัสและเก็บเป็นความลับตามมาตรฐานสูงสุด',
    },
  ]);

  const stats = [
      { value: '10x', label: 'ประเมินเบื้องต้นเร็วกว่า' },
      { value: '50+', label: 'ทนายความ SME ที่ผ่านการคัดเลือก' },
      { value: '24/7', label: 'AI พร้อมให้คำปรึกษา' },
      { value: '100%', label: 'แพลตฟอร์มปลอดภัย' },
  ]
  
  const [recommendedLawyers, setRecommendedLawyers] = useState<LawyerProfile[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [homepageBanners, setHomepageBanners] = useState<Ad[]>([]);
  const [sidebarAds, setSidebarAds] = useState<Ad[]>([]);
  
  const [isFindingLawyers, setIsFindingLawyers] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const { setAiChatOpen } = useChat();

  // State for lawyer verification
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'found' | 'not_found' | 'error' | null>(null);
  const [verifiedLawyer, setVerifiedLawyer] = useState<LawyerProfile | null>(null);
  
  const partners = [
    { name: 'สภาทนายความ' },
    { name: 'ETDA Thailand' },
    { name: 'DEPA' },
    { name: 'NIA' },
    { name: 'Techsauce' },
    { name: 'Krungsri Finnovate' },
  ];
  
  const carouselPlugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true })
  );

  useEffect(() => {
    async function fetchData() {
      const [lawyers, allArticles, banners, sidebarAdsData] = await Promise.all([
        getApprovedLawyers(),
        getAllArticles(),
        getAdsByPlacement('Homepage Carousel'),
        getAdsByPlacement('Lawyer Page Sidebar')
      ]);

      setRecommendedLawyers(lawyers.slice(0, 3));
      setArticles(allArticles.slice(0, 5));
      setHomepageBanners(banners);
      setSidebarAds(sidebarAdsData);
    }
    fetchData();
  }, []);

  const handleAnalysis = async () => {
    if (!analysisText.trim()) return;
    setIsFindingLawyers(true);
    try {
      const result = await findLawyerSpecialties({ problem: analysisText });
      const specialties = result.specialties.join(',');
      router.push(`/lawyers?specialties=${encodeURIComponent(specialties)}`);
    } catch (error) {
      console.error('Failed to find lawyer specialties:', error);
      // If AI fails, just go to the lawyers page without filter
      router.push('/lawyers');
    } finally {
      setIsFindingLawyers(false);
    }
  };

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const targetLicenseNumber = licenseNumber;
    if (!targetLicenseNumber) return;

    setIsVerifying(true);
    setVerificationResult(null);
    setVerifiedLawyer(null);

    // Simulate API call and verification logic
    setTimeout(async () => {
      try {
        if (targetLicenseNumber === '12345/2550') {
          const lawyer = await getLawyerById('1'); // Get a mock lawyer
          if (lawyer) {
            setVerifiedLawyer(lawyer);
            setVerificationResult('found');
          } else {
            setVerificationResult('not_found');
          }
        } else {
          setVerificationResult('not_found');
        }
      } catch (error) {
        setVerificationResult('error');
      } finally {
        setIsVerifying(false);
      }
    }, 1500);
  };

  const ResultCard = () => {
      if (isVerifying) {
        return (
          <div className="text-center text-muted-foreground mt-6">
            <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
            <p>กำลังตรวจสอบข้อมูลจากสภาทนายความ (จำลอง)...</p>
          </div>
        );
      }
      
      if (!verificationResult) return null;

      switch(verificationResult) {
          case 'found':
              if (!verifiedLawyer) return null;
              return (
                  <Card className="bg-gradient-to-br from-green-50 to-blue-50 mt-6 animate-in fade-in-50 overflow-hidden shadow-lg border-green-300 relative">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-shrink-0 text-center">
                          <Image
                            src={verifiedLawyer.imageUrl}
                            alt={verifiedLawyer.name}
                            width={120}
                            height={120}
                            className="rounded-full border-4 border-white shadow-md object-cover"
                          />
                          <div className="mt-4 flex items-center justify-center gap-2 text-green-700">
                             <ShieldCheck className="w-6 h-6"/>
                             <p className="font-bold text-lg">ยืนยันตัวตนแล้ว</p>
                          </div>
                        </div>
                        <div className="flex-grow text-center md:text-left">
                          <p className="text-muted-foreground text-sm">ผลการตรวจสอบเลขที่ใบอนุญาต: 12345/2550</p>
                          <h4 className="font-bold text-2xl mt-1 text-foreground">{verifiedLawyer.name}</h4>
                          <p className="text-primary font-semibold mt-1">{verifiedLawyer.specialty.join(', ')}</p>
                          <div className="mt-4">
                             <Button asChild>
                              <Link href={`/lawyers/${verifiedLawyer.id}`}>
                                  ดูโปรไฟล์ฉบับเต็ม
                              </Link>
                          </Button>
                          </div>
                        </div>
                         <div className="hidden md:block absolute top-1/2 right-8 -translate-y-1/2">
                          <Award className="w-24 h-24 text-green-500 opacity-20" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
              );
          case 'not_found':
              return (
                   <Card className="border-yellow-500 bg-yellow-50/50 mt-6 animate-in fade-in-50">
                      <CardHeader className="text-center">
                          <ShieldAlert className="w-12 h-12 mx-auto text-yellow-600"/>
                          <CardTitle className="text-yellow-800">ไม่พบข้อมูล</CardTitle>
                          <CardDescription>ไม่พบข้อมูลทนายความตามข้อมูลที่ระบุ<br/>กรุณาตรวจสอบความถูกต้อง หรือติดต่อเจ้าหน้าที่</CardDescription>
                      </CardHeader>
                  </Card>
              );
          default:
              return null;
      }
  }
  
  const mainArticle = articles[0];
  const otherArticles = articles.slice(1, 5);

  return (
    <>
      <div className="flex flex-col">
      <section className="w-full py-20 md:py-32 lg:py-40 bg-foreground text-background">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
                        
                        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline">
                            พันธมิตรกฎหมาย เคียงข้าง SMEs ไทย
                        </h1>
                        <p className="max-w-[600px] text-background/80 md:text-xl">
                            Lawlanes คือตลาดกลางทนายความออนไลน์ ที่เชื่อมต่อคุณกับผู้เชี่ยวชาญกฎหมายทั่วประเทศได้อย่างมั่นใจ
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link href="/lawyers">
                            <Button size="lg" variant="secondary">ดูรายชื่อทนายทั้งหมด</Button>
                            </Link>
                            <Button size="lg" variant="outline" className="bg-transparent text-background border-background hover:bg-background hover:text-foreground" onClick={() => setAiChatOpen(true)}>
                                คลิกแล้วเปิด แชท AI
                            </Button>
                        </div>
                    </div>

                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-rainbow-border-spin"></div>
                        <Card className="relative p-6 md:p-8 shadow-xl bg-card text-card-foreground rounded-2xl">
                            <div className="absolute top-4 right-4 bg-foreground/10 text-foreground p-3 rounded-full shadow-lg">
                                <Sparkles className="h-6 w-6" />
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                                <Scale className="h-7 w-7 text-foreground" />
                                <h2 className="text-2xl md:text-3xl font-bold font-headline">
                                ไม่แน่ใจว่าต้องการทนายด้านไหน?
                                </h2>
                            </div>
                            <p className="text-muted-foreground mb-6">
                                ให้ AI ช่วยวิเคราะห์ปัญหาเบื้องต้นและแนะนำทนายที่ตรงจุด
                            </p>
                            <div className="space-y-4">
                                <Textarea
                                  value={analysisText}
                                  onChange={(e) => setAnalysisText(e.target.value)}
                                  placeholder='อธิบายปัญหาของคุณที่นี่ เช่น "โดนโกงแชร์", "ต้องการจดทะเบียนบริษัท", "ปัญหาที่ดินกับเพื่อนบ้าน"'
                                  rows={4}
                                  className="bg-background/10 text-foreground placeholder:text-muted-foreground border-border"
                                />
                                <Button size="lg" className="w-full" onClick={handleAnalysis} disabled={isFindingLawyers}>
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

        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                    <div>
                        <p className="text-sm font-semibold text-primary uppercase">Lawlanes ทำงานอย่างไร</p>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-headline mt-2">
                            ขั้นตอนง่ายๆ เพื่อความชัดเจนทางกฎหมาย
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {stats.map((stat, index) => (
                            <Card key={index} className="p-4 bg-gray-100 border-none text-center">
                                <p className="text-4xl font-bold text-primary">{stat.value}</p>
                                <p className="text-sm text-muted-foreground">{stat.label}</p>
                            </Card>
                        ))}
                    </div>
                </div>
                <div className="space-y-8">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            {feature.icon}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">{feature.title}</h3>
                            <p className="text-muted-foreground mt-1">{feature.description}</p>
                        </div>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        </section>

        <section id="verify-lawyer-cta" className="w-full py-12 md:py-24 lg:py-32 bg-gray-50">
          <div className="container mx-auto px-4 md:px-6">
            
            <div className="max-w-4xl mx-auto">
                 <Card className="bg-foreground text-background rounded-2xl overflow-hidden shadow-2xl p-4 md:p-8">
                    <div className="flex flex-col items-center p-8 md:p-12 gap-6 text-center">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <ShieldCheck className="w-20 h-20 text-green-400 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-4xl md:text-5xl">ตรวจสอบสถานะทนายความ</h3>
                                <p className="text-background/80 mt-2 text-xl">สร้างความมั่นใจก่อนเริ่มจ้างงาน ด้วยการตรวจสอบข้อมูลใบอนุญาตว่าความ</p>
                            </div>
                        </div>
                        <div className="w-full max-w-lg mt-4">
                           <form 
                             className="flex flex-col sm:flex-row items-center gap-2 w-full"
                             onSubmit={handleVerify}
                           >
                              <Input
                                  name="licenseNumber"
                                  type="text"
                                  placeholder="กรอกเลขใบอนุญาต"
                                  className="h-12 bg-white/20 text-white placeholder:text-white/70 border-white/30 rounded-full text-base"
                                  value={licenseNumber}
                                  onChange={(e) => setLicenseNumber(e.target.value)}
                                  disabled={isVerifying}
                              />
                              <Button type="submit" size="lg" variant="secondary" className="w-full sm:w-auto font-bold h-12 rounded-full text-base" disabled={isVerifying}>
                                  {isVerifying ? <Loader2 className="animate-spin" /> : 'ตรวจสอบเลย'}
                              </Button>
                           </form>
                        </div>
                    </div>
                 </Card>
                 <ResultCard />
            </div>

            <section className="w-full py-12 md:py-24 lg:py-32">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-4">
                            <p className="text-sm font-semibold text-primary uppercase">สำหรับธุรกิจ SME</p>
                            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-headline">
                                ค้นหาทนายความที่เชี่ยวชาญ<br />และเหมาะสมกับธุรกิจของคุณ
                            </h2>
                            <p className="text-muted-foreground text-lg">
                                เพิ่มประสิทธิภาพ ลดขั้นตอนที่ซับซ้อน และลดความเสี่ยงทางกฎหมายด้วยการเชื่อมต่อกับเครือข่ายทนายความผู้เชี่ยวชาญของเรา
                            </p>
                             <div className="flex items-center gap-4 text-muted-foreground">
                                <ShieldCheck className="w-6 h-6 text-primary" />
                                <span>ทนายความที่ผ่านการตรวจสอบและยืนยันตัวตน</span>
                            </div>
                             <div className="flex items-center gap-4 text-muted-foreground">
                                <FileText className="w-6 h-6 text-primary" />
                                <span>เชี่ยวชาญหลากหลาย ทั้งคดีแพ่ง ฉ้อโกง และสัญญา</span>
                            </div>
                            <div className="pt-4">
                               <Button size="lg" asChild>
                                 <Link href="/lawyers">ดูทนายความทั้งหมด</Link>
                               </Button>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="aspect-video overflow-hidden rounded-2xl shadow-2xl">
                                <Image 
                                    src={getImageUrl('lawyer-team-working')}
                                    alt="Man in a suit holding a gavel"
                                    fill
                                    className="object-cover"
                                    data-ai-hint={getImageHint('lawyer-team-working')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
          </div>
        </section>

        <section className="w-full bg-background py-12 md:py-24 lg:py-32">
          <div className="container mx-auto px-4 md:px-6">
              <div className='text-center mb-12'>
                  <h2 className='text-3xl font-bold tracking-tight text-foreground font-headline sm:text-4xl'>ทนายที่แนะนำ</h2>
                  <p className="mt-2 text-muted-foreground">ทนายความที่ผ่านการคัดเลือกและมีความเชี่ยวชาญเฉพาะทาง</p>
                  <Separator className='w-24 mx-auto mt-4 bg-border' />
              </div>
              <div className="max-w-5xl mx-auto flex flex-col gap-4">
                  {recommendedLawyers.map((lawyer) => (
                  <div key={lawyer.id} className="bg-white rounded-lg shadow-md">
                      <LawyerCard lawyer={lawyer} />
                  </div>
                  ))}
              </div>
              <div className="mt-12 text-center">
                  <Button asChild size="lg" variant="outline" className="bg-white">
                      <Link href="/lawyers">ดูทนายทั้งหมด</Link>
                  </Button>
              </div>
          </div>
        </section>
        
        {homepageBanners.length > 0 && (
          <section className="w-full py-12 md:py-16 bg-background">
            <div className="container mx-auto px-4 md:px-6">
              <Carousel
                plugins={[carouselPlugin.current]}
                className="w-full"
                onMouseEnter={carouselPlugin.current.stop}
                onMouseLeave={carouselPlugin.current.reset}
              >
                <CarouselContent>
                  {homepageBanners.map((ad) => (
                    <CarouselItem key={ad.id}>
                      <div className="p-1">
                        <Card className="bg-secondary border-none">
                          <CardContent className="flex flex-col md:flex-row items-center justify-center p-6 md:p-12 gap-6">
                            <h3 className="text-2xl font-semibold text-center md:text-left">{ad.title}</h3>
                            <p className="text-muted-foreground text-center md:text-left">{ad.description}</p>
                            <Button>เรียนรู้เพิ่มเติม</Button>
                          </CardContent>
                        </Card>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden md:flex" />
                <CarouselNext className="hidden md:flex" />
              </Carousel>
            </div>
          </section>
        )}

        <section className="w-full bg-gray-50 py-12 md:py-24 lg:py-32">
            <div className="container mx-auto px-4 md:px-6">
                <div className='text-center mb-12'>
                    <h2 className='text-3xl font-bold tracking-tight text-foreground font-headline sm:text-4xl'>สำนักงานกฎหมายแนะนำ</h2>
                     <p className="mt-2 text-muted-foreground">พาร์ทเนอร์ที่เชื่อถือได้ พร้อมให้คำปรึกษาธุรกิจของคุณ</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {sidebarAds.slice(0, 3).map(ad => (
                    <Link href={`/law-firm/${ad.id}`} key={ad.id} className="group block">
                        <Card className="h-full overflow-hidden transition-shadow duration-300 hover:shadow-xl hover:-translate-y-1">
                            <CardHeader className="items-center text-center">
                                <div className="relative h-24 w-24">
                                     <Image 
                                        src={ad.imageUrl}
                                        alt={`${ad.title} logo`}
                                        fill
                                        className="object-contain rounded-md bg-white p-2 border"
                                     />
                                </div>
                                <CardTitle className="pt-4 group-hover:text-primary">{ad.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-center">
                                <p className="text-muted-foreground">{ad.description}</p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
                </div>
            </div>
        </section>

        <section id="articles" className="w-full py-12 md:py-24 lg:py-32 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline text-foreground">
                สาระน่ารู้ทางกฎหมาย
              </h2>
              <Link href="/articles">
                <Button variant="link" className="text-foreground hover:text-primary">
                  ดูทั้งหมด <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {articles.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Main Article */}
                {mainArticle && (
                  <Link href={`/articles/${mainArticle.slug}`} className="group block">
                    <Card className="border-none shadow-none bg-transparent p-0">
                      <CardContent className="p-0">
                        <div className="relative aspect-[4/3] mb-4 overflow-hidden rounded-lg">
                          <Image
                            src={mainArticle.imageUrl}
                            alt={mainArticle.title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            data-ai-hint={mainArticle.imageHint}
                          />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                           <Badge variant="secondary" className="absolute top-4 left-4">{mainArticle.category}</Badge>
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mt-4 leading-tight group-hover:text-primary">{mainArticle.title}</h3>
                        <p className="text-muted-foreground text-sm mt-2">{mainArticle.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                )}

                {/* Other Articles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {otherArticles.map((article) => (
                    <Link key={article.id} href={`/articles/${article.slug}`} className="group block">
                      <Card className="border-none shadow-none bg-transparent p-0 h-full flex flex-col">
                        <CardContent className="p-0">
                          <div className="relative aspect-[16/10] mb-3 overflow-hidden rounded-lg">
                            <Image
                              src={article.imageUrl}
                              alt={article.title}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              data-ai-hint={article.imageHint}
                            />
                            <div className="absolute inset-0 bg-black/20"></div>
                            <Badge variant="secondary" className="absolute top-2 right-2 text-xs">{article.category}</Badge>
                          </div>
                          <h4 className="font-semibold leading-snug group-hover:text-primary">{article.title}</h4>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <p>Loading articles...</p>
            )}

          </div>
        </section>
        
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-50">
          <div className="container mx-auto px-4 md:px-6 text-center">
             <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline text-foreground mb-8">
                ได้รับความไว้วางใจจาก
              </h2>
              <Carousel
                opts={{
                  align: "start",
                  loop: true,
                }}
                className="w-full max-w-5xl mx-auto"
              >
                <CarouselContent>
                  {partners.map((partner, index) => (
                    <CarouselItem key={index} className="basis-1/3 md:basis-1/4 lg:basis-1/6">
                      <div className="p-2">
                         <div className="flex aspect-video items-center justify-center p-4 bg-gray-100 rounded-lg">
                            <span className="text-sm font-semibold text-center text-muted-foreground">{partner.name}</span>
                          </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
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
                        <UserCheck className="mr-2 h-5 w-5" /> เข้าร่วมกับ Lawlanes
                    </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
