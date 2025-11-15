
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, MessageSquare, Users, Sparkles, Scale, ArrowRight, Newspaper, Loader2, Briefcase, UserCheck, ShieldCheck, ShieldAlert, Phone, Mail, File, Info } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getApprovedLawyers, getAllArticles, getLawyerById } from '@/lib/data';
import LawyerCard from '@/components/lawyer-card';
import type { LawyerProfile, Article } from '@/lib/types';
import { findLawyerSpecialties } from '@/ai/flows/find-lawyers-flow';
import { useChat } from '@/context/chat-context';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Logo from '@/components/logo';


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
  const { setAiChatOpen } = useChat();

  // State for lawyer verification
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'found' | 'not_found' | 'error' | null>(null);
  const [verifiedLawyer, setVerifiedLawyer] = useState<LawyerProfile | null>(null);

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
                  <Card className="border-green-500 bg-green-50/50 mt-6 animate-in fade-in-50">
                      <CardHeader className="text-center">
                          <ShieldCheck className="w-12 h-12 mx-auto text-green-600"/>
                          <CardTitle className="text-green-800">ตรวจสอบพบข้อมูล</CardTitle>
                          <CardDescription>ทนายความนี้ได้รับการยืนยันในระบบ Lawlane</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center text-center">
                          <Image
                            src={verifiedLawyer.imageUrl}
                            alt={verifiedLawyer.name}
                            width={100}
                            height={100}
                            className="rounded-full border-4 border-white shadow-lg"
                           />
                          <p className="font-bold text-xl mt-4">{verifiedLawyer.name}</p>
                          <p className="text-muted-foreground">เลขที่ใบอนุญาต: 12345/2550 (ข้อมูลจำลอง)</p>
                          <p className="text-primary font-semibold mt-1">{verifiedLawyer.specialty.join(', ')}</p>
                      </CardContent>
                      <CardFooter className="justify-center">
                          <Button asChild>
                              <Link href={`/lawyers/${verifiedLawyer.id}`}>
                                  ดูโปรไฟล์
                              </Link>
                          </Button>
                      </CardFooter>
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
  const otherArticles = articles.slice(1, 7);

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
                            <Button size="lg" variant="outline" className="bg-transparent text-background border-background hover:bg-background hover:text-foreground" onClick={() => setAiChatOpen(true)}>
                                ปรึกษากฎหมายเบื้องต้น
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
                                ให้ AI ช่วยวิเคราะห์ปัญหาเบื้องต้นและแนะนำทนายที่ตรงจุดให้คุณ
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

        <section id="features" className="w-full py-12 md:py-24 lg:py-20 bg-background text-foreground">
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
                <Card key={index} className="h-full bg-card hover:shadow-lg transition-shadow duration-300 border-gray-200 rounded-2xl">
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

        <section id="verify-lawyer-cta" className="w-full py-12 md:py-24 lg:py-32 bg-gray-50">
          <div className="container mx-auto px-4 md:px-6">
            
            <div className="max-w-4xl mx-auto">
                 <Card className="bg-foreground text-background rounded-2xl overflow-hidden">
                    <div className="flex flex-col items-center p-8 gap-6 text-center">
                        <div className="flex items-center gap-5">
                            <ShieldCheck className="w-12 h-12 text-green-400 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-2xl">ตรวจสอบสถานะทนายความ</h3>
                                <p className="text-background/80 mt-1">สร้างความมั่นใจก่อนเริ่มจ้างงาน ด้วยการตรวจสอบข้อมูลใบอนุญาตว่าความ</p>
                            </div>
                        </div>
                        <div className="w-full max-w-lg">
                           <form 
                             className="flex flex-col sm:flex-row items-center gap-2 w-full"
                             onSubmit={handleVerify}
                           >
                              <Input
                                  name="licenseNumber"
                                  type="text"
                                  placeholder="กรอกเลขใบอนุญาต"
                                  className="h-12 bg-white/20 text-white placeholder:text-white/70 border-white/30 rounded-full"
                                  value={licenseNumber}
                                  onChange={(e) => setLicenseNumber(e.target.value)}
                                  disabled={isVerifying}
                              />
                              <Button type="submit" size="lg" variant="secondary" className="w-full sm:w-auto font-bold h-12 rounded-full" disabled={isVerifying}>
                                  {isVerifying ? <Loader2 className="animate-spin" /> : 'ตรวจสอบเลย'}
                              </Button>
                           </form>
                        </div>
                    </div>
                 </Card>
                 <ResultCard />
            </div>

            <div className="text-center mt-24 mb-12">
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

             <div className="mt-20">
                <Card className="relative rounded-2xl overflow-hidden shadow-2xl text-white">
                  <Image
                    src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHRlYW18ZW58MHx8fHwxNjc3MjU1Mjc2fDA&ixlib=rb-4.1.0&q=80&w=1080"
                    alt="Law firm advertisement"
                    fill
                    className="object-cover"
                    data-ai-hint="business team"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-blue-900/60 to-transparent p-12 flex flex-col justify-center">
                    <Logo className="text-white text-4xl mb-4" />
                    <h3 className="text-3xl font-bold max-w-md">ทีมกฎหมายมืออาชีพ พร้อมดูแลธุรกิจของคุณ</h3>
                    <p className="mt-2 max-w-lg text-white/80">บริการให้คำปรึกษาครบวงจรสำหรับ SMEs, Startups, และองค์กร</p>
                    <div className="mt-6 space-y-2 text-sm">
                        <div className="flex items-center gap-2"><CheckCircle className="text-green-400" /> <span>ให้คำปรึกษาด้านสัญญาและเอกสารทางกฎหมาย</span></div>
                        <div className="flex items-center gap-2"><CheckCircle className="text-green-400" /> <span>ดูแลคดีความและข้อพิพาททางธุรกิจ</span></div>
                        <div className="flex items-center gap-2"><CheckCircle className="text-green-400" /> <span>วางโครงสร้างบริษัทและธุรกรรม</span></div>
                    </div>
                     <div className="mt-8">
                        <Button variant="secondary" size="lg">ติดต่อเราเพื่อรับคำปรึกษา</Button>
                    </div>
                  </div>
                </Card>
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
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline text-foreground">
                บทความกฎหมายน่ารู้
              </h2>
              <Link href="/articles">
                <Button variant="link" className="text-foreground">
                  ดูทั้งหมด <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            {articles.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Main Article */}
                    {mainArticle && (
                        <Link href={`/articles/${mainArticle.slug}`} className="group block">
                            <Card className="overflow-hidden h-full">
                                <div className="relative aspect-[4/3]">
                                    <Image
                                        src={mainArticle.imageUrl}
                                        alt={mainArticle.title}
                                        fill
                                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                                        data-ai-hint={mainArticle.imageHint}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                    <div className="absolute bottom-0 left-0 p-6">
                                        <Badge variant="secondary">{mainArticle.category}</Badge>
                                        <h3 className="text-2xl font-bold text-white mt-2 leading-tight group-hover:underline">{mainArticle.title}</h3>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    )}
                    
                    {/* Other Articles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {otherArticles.map((article) => (
                           <Link key={article.id} href={`/articles/${article.slug}`} className="group block">
                             <Card className="overflow-hidden h-full flex flex-col">
                                <div className="relative aspect-video">
                                     <Image
                                        src={article.imageUrl}
                                        alt={article.title}
                                        fill
                                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                                        data-ai-hint={article.imageHint}
                                    />
                                     <div className="absolute top-2 right-2">
                                        <Badge variant="secondary" className="text-xs">{article.category}</Badge>
                                     </div>
                                </div>
                                <CardContent className="p-4 flex-grow">
                                    <h4 className="font-semibold leading-snug group-hover:underline">{article.title}</h4>
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

      </div>
    </>
  );
}
