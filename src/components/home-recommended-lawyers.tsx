'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import LawyerCard from '@/components/lawyer-card';
import FeaturedLawyerCard from '@/components/featured-lawyer-card';
import { useFirebase } from '@/firebase';
import { getApprovedLawyers } from '@/lib/data';
import { LawyerProfile } from '@/lib/types';
import { EmptyState } from '@/components/ui/empty-state';
import { FadeIn } from '@/components/fade-in';
import { useTranslations } from 'next-intl';
import LawyerFilterSidebar from '@/components/lawyer-filter';

interface HomeRecommendedLawyersProps {
    initialLawyers?: LawyerProfile[];
}

export function HomeRecommendedLawyers({ initialLawyers }: HomeRecommendedLawyersProps) {
    const { firestore } = useFirebase();
    const [lawyers, setLawyers] = useState<LawyerProfile[]>(initialLawyers || []);
    const [loading, setLoading] = useState(!initialLawyers);
    const t = useTranslations('HomePage.recommendedLawyers');
    const FEATURED_LAWYER_NAMES = ['กฤตเมธ ไวโส'];

    // Sort featured lawyers first
    const sortFeaturedFirst = (list: LawyerProfile[]) =>
        [...list].sort((a, b) => {
            const isFeatA = FEATURED_LAWYER_NAMES.some(name => a.name?.includes(name));
            const isFeatB = FEATURED_LAWYER_NAMES.some(name => b.name?.includes(name));
            if (isFeatA && !isFeatB) return -1;
            if (!isFeatA && isFeatB) return 1;
            return 0;
        });

    useEffect(() => {
        if (initialLawyers && initialLawyers.length > 0) {
            setLawyers(sortFeaturedFirst(initialLawyers));
            return;
        }

        async function fetchLawyers() {
            if (!firestore) return;
            try {
                const fetchedLawyers = await getApprovedLawyers(firestore);
                setLawyers(sortFeaturedFirst(fetchedLawyers.slice(0, 10)));
            } catch (error) {
                console.error("Error fetching lawyers:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchLawyers();
    }, [firestore]);

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
                                        {FEATURED_LAWYER_NAMES.some(name => lawyer.name?.includes(name)) ? (
                                            <FeaturedLawyerCard lawyer={lawyer} />
                                        ) : (
                                            <LawyerCard lawyer={lawyer} />
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
                    </div>
                </div>
            </div>
        </section>
    );
}
