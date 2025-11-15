'use client';

import { getLawyerById } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { StarIcon } from '@/components/icons/star-icon';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, Trophy, BookCopy } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import React, { useState, useEffect } from 'react';
import type { LawyerProfile } from '@/lib/types';
import ChatModal from '@/components/chat/chat-modal';

export default function LawyerProfilePage({ params }: { params: { id: string } }) {
  const [lawyer, setLawyer] = useState<LawyerProfile | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState('');

  useEffect(() => {
    async function fetchLawyer() {
      const lawyerData = await getLawyerById(params.id);
      if (!lawyerData) {
        notFound();
      }
      setLawyer(lawyerData);
    }
    fetchLawyer();
  }, [params.id]);
  
  const handleConsultClick = (type: 'consult' | 'message') => {
      const prompt = type === 'consult' 
          ? `สวัสดีครับ สนใจนัดปรึกษาคุณ ${lawyer?.name} ครับ`
          : `สวัสดีครับ สนใจส่งข้อความปรึกษาคุณ ${lawyer?.name} ครับ`;
      setInitialPrompt(prompt);
      setIsChatOpen(true);
  }
  
  const clearInitialPrompt = () => {
      setInitialPrompt('');
  }


  if (!lawyer) {
    return <div>Loading...</div>; // Or a loading skeleton
  }

  const rating = (Number(lawyer.id) % 2) + 3.5;
  const reviewCount = Number(lawyer.id) * 7 + 5;
  const caseWinRate = (Number(lawyer.id) * 3 + 80);
  const totalCases = (Number(lawyer.id) * 25 + 100);

  const mockReviews = [
    {
      id: 1,
      author: 'คุณสมศักดิ์',
      avatar: `https://picsum.photos/seed/rev1-${lawyer.id}/40/40`,
      rating: 5,
      comment: `คุณ ${lawyer.name.split(' ')[1]} ให้คำปรึกษาดีมากครับ เข้าใจง่ายและเป็นกันเอง ช่วยแก้ปัญหาเรื่องสัญญาที่ซับซ้อนของบริษัทผมได้อย่างมืออาชีพ แนะนำเลยครับ`,
      date: 'กรกฎาคม 2024',
    },
    {
      id: 2,
      author: 'SME เจ้าของกิจการ',
      avatar: `https://picsum.photos/seed/rev2-${lawyer.id}/40/40`,
      rating: 4,
      comment: 'ดำเนินการรวดเร็ว ติดต่อง่าย อธิบายข้อกฎหมายได้ชัดเจน แต่บางครั้งอาจจะตอบช้าไปบ้าง โดยรวมถือว่าประทับใจครับ',
      date: 'มิถุนายน 2024',
    },
     {
      id: 3,
      author: 'คุณวิภา',
      avatar: `https://picsum.photos/seed/rev3-${lawyer.id}/40/40`,
      rating: 5,
      comment: 'ยอดเยี่ยมมากค่ะ ช่วยเหลือเรื่องคดีฉ้อโกงได้อย่างเต็มที่ ทำให้ได้รับความเป็นธรรมกลับคืนมา ขอบคุณมากๆ ค่ะ',
      date: 'พฤษภาคม 2024',
    },
  ];

  return (
    <>
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="max-w-4xl mx-auto">
            <Link href="/lawyers" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                กลับไปหน้ารายชื่อทนาย
            </Link>

            <Card className="overflow-hidden">
                <div className="bg-card">
                    <div className="p-8 flex flex-col md:flex-row items-center gap-8">
                        <div className="relative h-32 w-32 flex-shrink-0">
                            <Image
                                src={lawyer.imageUrl}
                                alt={lawyer.name}
                                fill
                                className="rounded-full object-cover border-4 border-white shadow-lg"
                                data-ai-hint={lawyer.imageHint}
                                priority
                            />
                        </div>
                        <div className="text-center md:text-left">
                            <h1 className="text-3xl font-bold font-headline text-foreground">{lawyer.name}</h1>
                            <p className="text-lg text-primary font-semibold mt-1">{lawyer.specialty[0]}</p>
                            <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                                <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <StarIcon key={i} className={`w-5 h-5 ${i < Math.floor(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                                ))}
                                </div>
                                <span className="text-muted-foreground">({reviewCount} รีวิว)</span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                                {lawyer.specialty.map((spec, index) => (
                                    <Badge key={index} variant="secondary">{spec}</Badge>
                                ))}
                            </div>
                        </div>
                         <div className="flex-shrink-0 flex flex-col items-center justify-center gap-3 w-full md:w-40 md:ml-auto">
                            <Button className="w-full bg-foreground text-background hover:bg-foreground/90" onClick={() => handleConsultClick('consult')}>
                                <Phone className="mr-2 h-4 w-4" /> นัดปรึกษา
                            </Button>
                            <Button variant="outline" className="w-full" onClick={() => handleConsultClick('message')}>
                                <Mail className="mr-2 h-4 w-4" /> ส่งข้อความ
                            </Button>
                         </div>
                    </div>
                </div>

                <div className="p-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>เกี่ยวกับ</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <p className="text-muted-foreground">{lawyer.description}</p>
                        </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-6 mt-6">
                        <Card>
                             <CardHeader>
                                <CardTitle>การศึกษาและใบอนุญาต</CardTitle>
                            </CardHeader>
                             <CardContent className="text-muted-foreground space-y-2">
                                <p>นิติศาสตรบัณฑิต (เกียรตินิยม) - จุฬาลงกรณ์มหาวิทยาลัย</p>
                                <p>ใบอนุญาตให้ว่าความเลขที่ 12345/2550</p>
                             </CardContent>
                        </Card>
                         <Card>
                             <CardHeader>
                                <CardTitle>ประสบการณ์</CardTitle>
                            </CardHeader>
                             <CardContent className="text-muted-foreground">
                                <p>15+ ปี ในการว่าความคดีแพ่งและพาณิชย์</p>
                             </CardContent>
                        </Card>
                    </div>

                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>สถิติการว่าความ (จำลอง)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="p-4 bg-secondary/50 rounded-lg">
                                    <Trophy className="mx-auto h-8 w-8 text-yellow-500 mb-2" />
                                    <p className="text-2xl font-bold">{caseWinRate}%</p>
                                    <p className="text-sm text-muted-foreground">อัตราการชนะคดี</p>
                                </div>
                                <div className="p-4 bg-secondary/50 rounded-lg">
                                    <BookCopy className="mx-auto h-8 w-8 text-foreground/70 mb-2" />
                                    <p className="text-2xl font-bold">{totalCases}+</p>
                                    <p className="text-sm text-muted-foreground">คดีที่ให้คำปรึกษา</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>รีวิวจากผู้ใช้บริการ ({mockReviews.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {mockReviews.map((review, index) => (
                                    <React.Fragment key={review.id}>
                                        <div className="flex gap-4">
                                            <Avatar>
                                                <AvatarImage src={review.avatar} alt={review.author} />
                                                <AvatarFallback>{review.author.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold">{review.author}</p>
                                                    <span className="text-xs text-muted-foreground">{review.date}</span>
                                                </div>
                                                <div className="flex items-center gap-1 my-1">
                                                    {[...Array(5)].map((_, i) => (
                                                        <StarIcon key={i} className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                                                    ))}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{review.comment}</p>
                                            </div>
                                        </div>
                                        {index < mockReviews.length - 1 && <Separator />}
                                    </React.Fragment>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </Card>
        </div>
      </div>
    </div>
    <ChatModal isOpen={isChatOpen} onOpenChange={setIsChatOpen} initialPrompt={initialPrompt} clearInitialPrompt={clearInitialPrompt} />
    </>
  );
}
