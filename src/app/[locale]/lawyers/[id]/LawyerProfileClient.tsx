'use client';
import { useSearchParams } from 'next/navigation';

import { getLawyerStatsAction } from '@/app/actions/dashboard-actions';
import { getReviewsAction } from '@/app/actions/review-actions';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Trophy, BookCopy, Mail, Phone, Scale } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import React, { useState, useEffect } from 'react';
import type { LawyerProfile } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { doc, getDoc, setDoc, collection, serverTimestamp, addDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import profileLawyerImg from '@/pic/profile-lawyer.jpg';
import { useTranslations, useLocale } from 'next-intl';
import { getSpecialtyKey } from '@/lib/specialties';
import { ShareButtons } from '@/components/share-buttons';
import { getCloudflareVariantUrl } from '@/lib/cloudflare-images';

interface LawyerProfileClientProps {
    initialLawyer: LawyerProfile;
    id: string;
}

export default function LawyerProfileClient({ initialLawyer, id }: LawyerProfileClientProps) {
    const router = useRouter();
    const { firestore, user } = useFirebase();
    const t = useTranslations('LawyerProfile');
    const tLawyers = useTranslations('Lawyers');
    const locale = useLocale();

    const [lawyer, setLawyer] = useState<LawyerProfile>(initialLawyer);
    const [reviews, setReviews] = useState<any[]>([]);
    const [isLawyer, setIsLawyer] = useState(false);
    const [stats, setStats] = useState({ responseRate: 0, completedCases: 0 });
    const { toast } = useToast();

    // Modal States
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [initialMessage, setInitialMessage] = useState("");
    const [isCreatingChat, setIsCreatingChat] = useState(false);

    // Helper to translate specialty
    const translateSpecialty = (spec: string) => {
        const key = getSpecialtyKey(spec);
        return key ? tLawyers(`specialties.${key}`) : spec;
    };

    // Helper function to get localized content
    const getLocalizedContent = (
        thContent: string | undefined,
        enContent: string | undefined,
        zhContent: string | undefined,
        fallback: string
    ) => {
        if (locale === 'en') return enContent || thContent || fallback;
        if (locale === 'zh') return zhContent || thContent || fallback;
        return thContent || fallback;
    };

    useEffect(() => {
        async function checkUserRole() {
            if (!user || !firestore) return;
            const lawyerDocRef = doc(firestore, "lawyerProfiles", user.uid);
            const lawyerSnap = await getDoc(lawyerDocRef);
            if (lawyerSnap.exists()) {
                setIsLawyer(true);
            }
        }
        checkUserRole();
    }, [user, firestore]);

    const searchParams = useSearchParams();
    const autoOpenChat = searchParams.get('chat') === 'true';

    useEffect(() => {
        if (autoOpenChat && user && !isLawyer) {
            setIsMessageModalOpen(true);
        }
    }, [autoOpenChat, user, isLawyer]);

    useEffect(() => {
        async function fetchReviewsAndStats() {
            if (!id) return;

            // Fetch Reviews via Server Action
            try {
                const reviewsData = await getReviewsAction(id);
                // Convert string dates back to Date objects if needed, or use dateText
                const formattedReviews = reviewsData.map((r: any) => ({
                    ...r,
                    date: r.dateText
                }));
                setReviews(formattedReviews);
            } catch (error) {
                console.error("Error fetching reviews:", error);
            }

            // Fetch Stats
            try {
                const lawyerStats = await getLawyerStatsAction(id);
                setStats({
                    responseRate: lawyerStats.responseRate,
                    completedCases: lawyerStats.completedCases
                });
            } catch (error) {
                console.error("Error fetching stats:", error);
            }
        }
        fetchReviewsAndStats();
    }, [id, firestore]);

    const reviewCount = reviews.length;
    const averageRating = reviewCount > 0
        ? reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviewCount
        : 0;

    const handleStartChat = () => {
        if (lawyer) {
            if (!user) {
                router.push('/login');
                return;
            }
            setIsMessageModalOpen(true);
        }
    };

    const handleSendMessage = async () => {
        if (!initialMessage.trim()) {
            toast({
                variant: 'destructive',
                title: 'กรุณากรอกข้อความ',
                description: 'เพื่อให้ทนายทราบถึงปัญหาของคุณเบื้องต้น',
            });
            return;
        }
        if (!user || !firestore || !lawyer) return;

        setIsCreatingChat(true);

        try {
            const newChatId = uuidv4();
            const chatRef = doc(firestore, 'chats', newChatId);
            const messagesRef = collection(chatRef, 'messages');

            const targetLawyerUserId = lawyer.userId || lawyer.id;

            const chatPayload = {
                participants: [user.uid, targetLawyerUserId],
                createdAt: serverTimestamp(),
                caseTitle: `Ticket สนทนา: ${initialMessage.substring(0, 30)}...`,
                status: 'active',
                lawyerId: lawyer.id, 
                userId: user.uid, 
                lastMessage: initialMessage,
                lastMessageAt: serverTimestamp(),
                amount: 0, 
                originalFee: 0,
                discount: 0,
                couponCode: null,
                couponId: null
            };

            await setDoc(chatRef, chatPayload);

            const messagePayload = {
                text: initialMessage,
                senderId: user.uid,
                timestamp: serverTimestamp(),
            };
            await addDoc(messagesRef, messagePayload);

            // Send notification email
            import('@/app/actions/email').then(({ sendLawyerNewCaseEmail }) => {
                const caseLink = `${window.location.origin}/chat/${newChatId}?lawyerId=${lawyer.id}&clientId=${user.uid}&view=lawyer`;
                sendLawyerNewCaseEmail(
                    lawyer.email,
                    lawyer.name,
                    user.displayName || 'ลูกความ',
                    `Ticket สนทนา: ${initialMessage.substring(0, 30)}...`,
                    caseLink
                ).then(res => console.log("Email sent:", res)).catch(console.error);
            });

            toast({
                title: "ส่งข้อความสำเร็จ",
                description: "กำลังนำคุณไปยังห้องแชท...",
            });

            setIsMessageModalOpen(false);
            router.push(`/chat/${newChatId}?lawyerId=${lawyer.id}`);
        } catch (error) {
            console.error("Error creating chat:", error);
            toast({
                variant: 'destructive',
                title: 'เกิดข้อผิดพลาด',
                description: 'ไม่สามารถส่งข้อความได้ กรุณาลองใหม่อีกครั้ง',
            });
        } finally {
            setIsCreatingChat(false);
        }
    };

    const description = getLocalizedContent(
        lawyer.description,
        lawyer.descriptionEn,
        lawyer.descriptionZh,
        ''
    );
    const education = getLocalizedContent(
        lawyer.education,
        lawyer.educationEn,
        lawyer.educationZh,
        t('noEducation')
    );
    const experience = getLocalizedContent(
        lawyer.experience,
        lawyer.experienceEn,
        lawyer.experienceZh,
        t('noExperience')
    );

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="container mx-auto px-4 md:px-6 py-12">
                <div className="max-w-4xl mx-auto">
                    <Link href="/lawyers" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        {t('backToList')}
                    </Link>

                    <Card className="overflow-hidden rounded-3xl shadow-sm border-none">
                        <div className="bg-card">
                            <div className="p-8 flex flex-col md:flex-row items-center gap-8">
                                <div className="relative h-32 w-32 flex-shrink-0">
                                    <Image
                                        src={getCloudflareVariantUrl(lawyer.imageUrl, 'public') || profileLawyerImg}
                                        alt={lawyer.name}
                                        fill
                                        className="rounded-full object-cover border-4 border-white shadow-lg"
                                        data-ai-hint={lawyer.imageHint}
                                        priority
                                    />
                                </div>
                                <div className="text-center md:text-left flex-grow">
                                    <h1 className="text-3xl font-bold font-headline text-foreground">{lawyer.name}</h1>
                                    {lawyer.specialty?.[0] && <p className="text-lg text-primary font-semibold mt-1">{translateSpecialty(lawyer.specialty[0])}</p>}
                                    <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                                        <div className="flex items-center gap-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Scale key={i} className={`w-5 h-5 ${i < Math.round(averageRating) ? 'text-yellow-500 fill-yellow-500/20' : 'text-gray-300'}`} />
                                            ))}
                                        </div>
                                        <span className="text-muted-foreground">({reviewCount} {t('reviews')})</span>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                                        {(lawyer.specialty || []).map((spec, index) => (
                                            <Badge key={index} variant="secondary">{translateSpecialty(spec)}</Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-shrink-0 flex flex-col items-center justify-center gap-3 w-full md:w-40 md:ml-auto">
                                    {isLawyer ? (
                                        <div className="text-center p-2 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-800">
                                            {t('lawyerCannotBook')}
                                        </div>
                                    ) : (
                                        <>
                                            <Button onClick={handleStartChat} variant="outline" className="w-full">
                                                <Mail className="mr-2 h-4 w-4" /> {t('sendMessage')}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-8">
                            <Card className="rounded-3xl shadow-sm border-none">
                                <CardHeader>
                                    <CardTitle>{t('about')}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">{description}</p>
                                </CardContent>
                            </Card>

                            <div className="grid md:grid-cols-2 gap-6 mt-6">
                                <Card className="rounded-3xl shadow-sm border-none">
                                    <CardHeader>
                                        <CardTitle>{t('educationLicense')}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-muted-foreground space-y-2">
                                        <p>{education}</p>
                                        <p>{t('licenseNumber')} {lawyer.licenseNumber}</p>
                                    </CardContent>
                                </Card>
                                <Card className="rounded-3xl shadow-sm border-none">
                                    <CardHeader>
                                        <CardTitle>{t('experience')}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-muted-foreground">
                                        <p>{experience}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="mt-6 rounded-3xl shadow-sm border-none">
                                <CardHeader>
                                    <CardTitle>{t('workStats')}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-4 text-center">
                                        <div className="p-4 bg-secondary/50 rounded-lg">
                                            <Trophy className="mx-auto h-8 w-8 text-yellow-500 mb-2" />
                                            <p className="text-2xl font-bold">{stats.responseRate}%</p>
                                            <p className="text-sm text-muted-foreground">{t('responseRate')}</p>
                                        </div>
                                        <div className="p-4 bg-secondary/50 rounded-lg">
                                            <BookCopy className="mx-auto h-8 w-8 text-foreground/70 mb-2" />
                                            <p className="text-2xl font-bold">{stats.completedCases}</p>
                                            <p className="text-sm text-muted-foreground">{t('completedCases')}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="mt-6 rounded-3xl shadow-sm border-none">
                                <CardContent className="p-6">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-foreground">แนะนำทนายท่านนี้</h3>
                                            <p className="text-sm text-muted-foreground">ร่วมแชร์ประสบการณ์ดีๆ หรือแนะนำทนายความท่านนี้ให้กับเพื่อนของคุณ</p>
                                        </div>
                                        <ShareButtons
                                            title={`ทนายความ ${lawyer.name}`}
                                            description={description}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="mt-6 rounded-3xl shadow-sm border-none">
                                <CardHeader>
                                    <CardTitle>{t('userReviews')} ({reviewCount})</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-6">
                                        {reviews.length === 0 ? (
                                            <p className="text-center text-muted-foreground py-4">{t('noReviews')}</p>
                                        ) : (
                                            reviews.map((review, index) => (
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
                                                                    <Scale key={i} className={`w-4 h-4 ${i < review.rating ? 'text-yellow-500 fill-yellow-500/20' : 'text-gray-300'}`} />
                                                                ))}
                                                            </div>
                                                            <p className="text-sm text-muted-foreground">{review.comment}</p>
                                                        </div>
                                                    </div>
                                                    {index < reviews.length - 1 && <Separator />}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Free Chat Initial Message Modal */}
            <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
                <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:rounded-[2rem] border-none">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
                        <div className="p-6 pb-4 sm:p-8 sm:pb-6 relative z-10">
                            <div className="flex items-center gap-4 mb-4">
                                <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-sm">
                                    <AvatarImage src={getCloudflareVariantUrl(lawyer.imageUrl, 'public') || profileLawyerImg.src} alt={lawyer.name} className="object-cover" />
                                    <AvatarFallback>{lawyer.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="text-xl font-bold text-foreground leading-tight">{lawyer.name}</h2>
                                    {lawyer.specialty?.[0] && (
                                        <p className="text-sm font-medium text-primary">{translateSpecialty(lawyer.specialty[0])}</p>
                                    )}
                                </div>
                            </div>
                            <DialogHeader className="text-left">
                                <DialogTitle className="text-2xl font-headline font-bold text-foreground">ปรึกษาทนายความ</DialogTitle>
                                <DialogDescription className="text-base text-muted-foreground mt-1">
                                    กรอกรายละเอียดปัญหาเบื้องต้น เพื่อให้ทนายความประเมินแนวทางการช่วยเหลือฟรี
                                </DialogDescription>
                            </DialogHeader>
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto px-6 sm:px-8 space-y-6">
                        <div className="grid w-full gap-2">
                            <Label htmlFor="message" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
                                ข้อความถึงทนาย
                            </Label>
                            <Textarea
                                id="message"
                                placeholder="เช่น มีปัญหาเรื่องที่ดินโดนบุกรุก อยากปรึกษาว่าต้องทำอย่างไร หรือ ส่งข้อตกลงเพื่อร่างสัญญา..."
                                value={initialMessage}
                                onChange={(e) => setInitialMessage(e.target.value)}
                                rows={6}
                                className="resize-none rounded-2xl border-primary/10 focus:border-primary/30 focus:ring-primary/20 bg-muted/30 p-4 transition-all duration-200"
                            />
                        </div>
                        <div className="bg-primary/5 rounded-2xl p-4 flex items-start gap-4 border border-primary/10">
                            <div className="mt-1 bg-primary/20 p-2 rounded-full">
                                <Scale className="h-4 w-4 text-primary" />
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                การให้คำปรึกษาเบื้องต้นไม่มีค่าใช้จ่าย ทนายอาจเสนอราคาหากต้องมีการดำเนินเรื่องทางกฎหมายที่ซับซ้อน
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="p-6 sm:p-8 pt-4 sm:pt-4 bg-white/50 backdrop-blur-sm sm:flex-row flex-col gap-3 sm:gap-4 border-t border-gray-100">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsMessageModalOpen(false)} 
                            disabled={isCreatingChat}
                            className="w-full sm:w-auto rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors order-2 sm:order-1"
                        >
                            ยกเลิก
                        </Button>
                        <Button 
                            onClick={handleSendMessage} 
                            disabled={isCreatingChat || !initialMessage.trim()}
                            className="w-full sm:flex-1 h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-lg shadow-foreground/10 text-base font-semibold order-1 sm:order-2"
                        >
                            {isCreatingChat ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    กำลังเปิดห้องแชท...
                                </>
                            ) : (
                                "ส่งข้อความถึงทนาย"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
