import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Users, ShieldCheck, ArrowRight, Briefcase, UserCheck, FileText } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getApprovedLawyers, getAllArticles, getAdsByPlacement, getImageUrl, getImageHint } from '@/lib/data';
import LawyerCard from '@/components/lawyer-card';
import AiAnalysisCard from '@/components/ai-analysis-card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { initializeFirebase } from '@/firebase';

async function getHomePageData(db: any) {
  // จำลองการดึงข้อมูล (In a real app, 'db' would be your Firestore instance)
  const [lawyers, allArticles, banners, sidebarAds] = await Promise.all([
    getApprovedLawyers(db),
    getAllArticles(db),
    getAdsByPlacement(db, 'Homepage Carousel'),
    getAdsByPlacement(db, 'Lawyer Page Sidebar')
  ]);

  return {
    recommendedLawyers: lawyers.slice(0, 3),
    articles: allArticles.slice(0, 5),
    homepageBanners: banners,
    sidebarAds: sidebarAds,
  };
}

export default async function Home() {
  const { firestore: db } = initializeFirebase();
  const { recommendedLawyers, articles } = await getHomePageData(db);

  // ข้อมูล Feature แบบภาษาไทย
  const features = [
    {
      icon: <MessageSquare className="w-6 h-6 text-blue-600" />,
      title: "ปรึกษาได้ทุกที่",
      description: "แชทหรือวิดีโอคอลกับทนายความได้ทันที ไม่ว่าจะอยู่ที่ไหน",
    },
    {
      icon: <Users className="w-6 h-6 text-blue-600" />,
      title: "ทนายความคัดคุณภาพ",
      description: "ทนายความทุกคนผ่านการตรวจสอบประวัติและใบอนุญาตเรียบร้อยแล้ว",
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-blue-600" />,
      title: "ปลอดภัยและเป็นส่วนตัว",
      description: "ข้อมูลคดีของคุณจะถูกเก็บเป็นความลับสูงสุด ด้วยมาตรฐานความปลอดภัย",
    },
  ];

  const stats = [
    { value: '10x', label: 'รวดเร็วกว่าเดิม' },
    { value: '50+', label: 'ทนายความผู้เชี่ยวชาญ' },
    { value: '24/7', label: 'บริการตลอด 24 ชม.' },
    { value: '100%', label: 'ความพึงพอใจ' },
  ];

  const mainArticle = articles[0];
  const otherArticles = articles.slice(1, 5);

  return (
    <>
      <div className="flex flex-col">
        <section className="relative w-full py-20 md:py-32 lg:py-40 text-background">
          <div className="absolute inset-0 z-[-1]">
            <Image
              src={getImageUrl('hero-main')}
              alt="Lawyers working"
              fill
              className="object-cover"
              data-ai-hint={getImageHint('hero-main')}
              priority
            />

          </div>
          <div className="container relative z-10 mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">

                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline">
                  ปรึกษาปัญหากฎหมายกับ<br />ทนายความมืออาชีพ
                </h1>
                <p className="max-w-[600px] text-background/80 md:text-xl">
                  แพลตฟอร์มที่เชื่อมโยงคุณกับทนายความผู้เชี่ยวชาญ ค้นหาทนายที่ใช่ หรือปรึกษา AI ทนายความอัจฉริยะได้ทันที
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href={`/lawyers`}>
                    <Button size="lg" variant="secondary">ค้นหาทนายความ</Button>
                  </Link>
                  <Link href={`/ai-advisor`}>
                    <Button size="lg" variant="outline" className="bg-transparent text-background border-background hover:bg-background hover:text-foreground">
                      ปรึกษา AI ทนายความ
                    </Button>
                  </Link>
                </div>
              </div>

              {/* หมายเหตุ: ถ้า AiAnalysisCard รับ props เป็น t หรือ lang อาจต้องไปแก้ไฟล์นั้นด้วย */}
              <AiAnalysisCard />
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div>
                  <p className="text-sm font-semibold text-primary uppercase">ขั้นตอนการใช้งาน</p>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-headline mt-2">
                    ใช้งานง่าย สะดวก และรวดเร็ว
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

        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-4">
                <p className="text-sm font-semibold text-primary uppercase">สำหรับธุรกิจ SME</p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-headline">
                  โซลูชันกฎหมายเพื่อธุรกิจ SME
                </h2>
                <p className="text-muted-foreground text-lg">
                  ลดความเสี่ยงทางกฎหมาย ช่วยให้ธุรกิจของคุณเติบโตได้อย่างมั่นคง ด้วยบริการที่ปรึกษากฎหมายมืออาชีพ
                </p>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                  <span>ร่างและตรวจสัญญาธุรกิจ</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <FileText className="w-6 h-6 text-primary" />
                  <span>ที่ปรึกษากฎหมายประจำบริษัท</span>
                </div>
                <div className="pt-4">
                  <Button size="lg" asChild>
                    <Link href={`/lawyers`}>ดูบริการสำหรับ SME</Link>
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

        <section className="w-full bg-gray-50 py-12 md:py-24 lg:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <div className='text-center mb-12'>
              <h2 className='text-3xl font-bold tracking-tight text-foreground font-headline sm:text-4xl'>ทนายความแนะนำ</h2>
              <p className="mt-2 text-muted-foreground">ทนายความที่มีประสบการณ์และความเชี่ยวชาญเฉพาะด้าน</p>
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
                <Link href={`/lawyers`}>ดูทนายความทั้งหมด</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="articles" className="w-full py-12 md:py-24 lg:py-32 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline text-foreground">
                บทความกฎหมายน่ารู้
              </h2>
              <Link href={`/articles`}>
                <Button variant="link" className="text-foreground hover:text-primary">
                  ดูทั้งหมด <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {articles.length > 0 && mainArticle ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Main Article */}
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
              <p>กำลังโหลดบทความ...</p>
            )}

          </div>
        </section>

        <section className="w-full bg-foreground text-background">
          <div className="container mx-auto px-4 md:px-6 py-12 md:py-24 lg:py-32">
            <div className="text-center">
              <div className="inline-block bg-background text-foreground p-3 rounded-full mb-4">
                <Briefcase className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">
                สำหรับทนายความ
              </h2>
              <p className="max-w-3xl mx-auto mt-4 text-background/80 md:text-xl">
                ร่วมเป็นส่วนหนึ่งกับเราเพื่อขยายฐานลูกความ และสร้างความน่าเชื่อถือบนโลกออนไลน์
              </p>
              <div className="mt-8">
                <Link href={`/for-lawyers`}>
                  <Button size="lg" variant="secondary" className="text-lg">
                    <UserCheck className="mr-2 h-5 w-5" /> สมัครเข้าร่วมเป็นทนายความ
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