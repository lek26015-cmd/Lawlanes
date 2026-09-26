'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import LawyerCard from '@/components/lawyer-card';
import FeaturedLawyerCard from '@/components/featured-lawyer-card';
import { getApprovedLawyersAction } from '@/app/actions/lawyer-directory-actions';
import { LawyerProfile } from '@/lib/types';
import { EmptyState } from '@/components/ui/empty-state';
import { FadeIn } from '@/components/fade-in';
import { useTranslations } from 'next-intl';
import LawyerFilterSidebar from '@/components/lawyer-filter';
import { Languages } from 'lucide-react';
import { InterpreterCard } from '@/components/interpreter/interpreter-card';
import type { PublicInterpreter } from '@/lib/interpreter-types';
import { lawyerDisplayTier, TIER_RANK } from '@/lib/provider-plans';

interface HomeRecommendedLawyersProps {
    initialLawyers?: LawyerProfile[];
    initialInterpreters?: PublicInterpreter[];
}

export function HomeRecommendedLawyers({ initialLawyers, initialInterpreters = [] }: HomeRecommendedLawyersProps) {
    const [lawyers, setLawyers] = useState<LawyerProfile[]>(initialLawyers || []);
    const [loading, setLoading] = useState(!initialLawyers);
    const t = useTranslations('HomePage.recommendedLawyers');
    const tInterp = useTranslations('HomePage.recommendedInterpreters');
    // แพลนบริษัท (การ์ดกรอบทอง) → Pro (ป้ายแนะนำ) → ฟรี — ดู src/lib/provider-plans.ts
    const sortFeaturedFirst = (list: LawyerProfile[]) =>
        list
            .map((l, i) => ({ l, i }))
            .sort((a, b) => TIER_RANK[lawyerDisplayTier(b.l as any)] - TIER_RANK[lawyerDisplayTier(a.l as any)] || a.i - b.i)
            .map(x => x.l);

    useEffect(() => {
        if (initialLawyers && initialLawyers.length > 0) {
            setLawyers(sortFeaturedFirst(initialLawyers));
            return;
        }

        async function fetchLawyers() {
            try {
                // ผ่าน server action + Admin SDK — ไม่ยิง lawyerProfiles จาก browser อีก
                const fetchedLawyers = await getApprovedLawyersAction(10);
                setLawyers(sortFeaturedFirst(fetchedLawyers as unknown as LawyerProfile[]));
            } catch (error) {
                console.error("Error fetching lawyers:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchLawyers();
    }, [initialLawyers]);

    if (loading) {
        return (
            <section className="relative w-full bg-slate-50 py-12 md:py-24 lg:py-32 overflow-hidden">
                <div className="container mx-auto px-4 md:px-6 relative z-10">
                    <div className='text-center mb-12'>
                        <h2 className='text-3xl font-bold tracking-tight text-foreground font-headline sm:text-4xl'>{t('title')}</h2>
                        <p className="mt-2 text-muted-foreground">{t('loading')}</p>
                        <Separator className='w-24 mx-auto mt-4 bg-border' />
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="relative w-full py-16 md:py-24 lg:py-32 overflow-hidden bg-slate-50">
            {/* Decorative Elements - Blue Theme (Subtle) */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[0%] right-[0%] w-[50%] h-[50%] rounded-full bg-blue-100/30 blur-3xl animate-pulse" />
                <div className="absolute bottom-[0%] left-[0%] w-[40%] h-[40%] rounded-full bg-indigo-50/50 blur-3xl" />
            </div>

            <div className="container mx-auto px-4 md:px-6 relative z-10">
                {/* Header Section */}
                <FadeIn direction="up">
                    <div className="flex flex-col items-center justify-center gap-6 mb-16 text-center">
                        <div className="w-full max-w-4xl xl:max-w-5xl px-4">
                            <h2 className='text-3xl font-bold tracking-tight text-[#0B3979] font-headline sm:text-5xl drop-shadow-sm'>{t('title')}</h2>
                            <p className="mt-4 text-slate-600 text-lg leading-relaxed">
                                {t('subtitle')}
                            </p>
                            <div className="w-24 h-1.5 bg-[#0B3979] rounded-full mt-6 mx-auto" />
                        </div>
                    </div>
                </FadeIn>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 xl:gap-12">
                    {/* Left Sidebar: Filter - Desktop Only */}
                    <aside className="hidden lg:block lg:col-span-1">
                        <div className="sticky top-24">
                            <LawyerFilterSidebar />
                        </div>
                    </aside>

                    {/* Main Content: Recommended Lawyers */}
                    <div className="lg:col-span-3">
                        {lawyers.length > 0 ? (
                            <div className="flex flex-col gap-6">
                                {lawyers.map((lawyer, index) => (
                                    <FadeIn key={lawyer.id} delay={index * 150} direction="up">
                                        {lawyerDisplayTier(lawyer as any) === 'top' ? (
                                            <FeaturedLawyerCard lawyer={lawyer} />
                                        ) : (
                                            <LawyerCard lawyer={lawyer} featured={lawyerDisplayTier(lawyer as any) === 'pro'} />
                                        )}
                                    </FadeIn>
                                ))}
                            </div>
                        ) : (
                            <FadeIn>
                                <EmptyState
                                    title={t('emptyTitle')}
                                    description={t('emptyDescription')}
                                />
                            </FadeIn>
                        )}

                        <div className="mt-12 text-center lg:text-left">
                            <FadeIn delay={400} direction="up">
                                <Button asChild size="lg" variant="outline" className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-md hover:shadow-lg transition-all px-10 py-6 rounded-full text-lg font-medium">
                                    <Link href={`/lawyers`}>{t('viewAll')}</Link>
                                </Button>
                            </FadeIn>
                        </div>

                        {/* ล่ามแนะนำ — ต่อจากทนาย ใช้ตัวกรองด้านซ้ายร่วมกัน (สลับเป็นโหมดล่ามได้) */}
                        <div className="mt-16 pt-12 border-t border-slate-200">
                                <FadeIn direction="up">
                                    <div className="mb-8 text-center lg:text-left">
                                        <h3 className="text-2xl font-bold tracking-tight text-[#0B3979] font-headline sm:text-3xl">{tInterp('title')}</h3>
                                        <p className="mt-2 text-slate-600 leading-relaxed">{tInterp('subtitle')}</p>
                                    </div>
                                </FadeIn>
                                {initialInterpreters.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {initialInterpreters.map((interpreter, index) => (
                                            <FadeIn key={interpreter.id} delay={index * 150} direction="up" className="h-full">
                                                <InterpreterCard interpreter={interpreter} />
                                            </FadeIn>
                                        ))}
                                    </div>
                                ) : (
                                    <FadeIn>
                                        <EmptyState
                                            icon={Languages}
                                            title={tInterp('emptyTitle')}
                                            description={tInterp('emptyDescription')}
                                        />
                                        <div className="text-center -mt-4">
                                            <Link href={`/for-interpreters`} className="text-sm font-medium text-[#0B3979] hover:underline">
                                                {tInterp('becomeInterpreter')}
                                            </Link>
                                        </div>
                                    </FadeIn>
                                )}
                                <div className="mt-12 text-center lg:text-left">
                                    <FadeIn delay={400} direction="up">
                                        <Button asChild size="lg" variant="outline" className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-md hover:shadow-lg transition-all px-10 py-6 rounded-full text-lg font-medium">
                                            <Link href={`/interpreters`}>{tInterp('viewAll')}</Link>
                                        </Button>
                                    </FadeIn>
                                </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
