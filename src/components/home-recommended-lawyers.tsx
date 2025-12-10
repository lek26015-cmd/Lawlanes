'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import LawyerCard from '@/components/lawyer-card';
import { useFirebase } from '@/firebase';
import { getApprovedLawyers } from '@/lib/data';
import { LawyerProfile } from '@/lib/types';

export function HomeRecommendedLawyers() {
    const { firestore } = useFirebase();
    const [lawyers, setLawyers] = useState<LawyerProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLawyers() {
            if (!firestore) return;
            try {
                const fetchedLawyers = await getApprovedLawyers(firestore);
                setLawyers(fetchedLawyers.slice(0, 3));
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
            <section className="w-full bg-gray-50 py-12 md:py-24 lg:py-32">
                <div className="container mx-auto px-4 md:px-6">
                    <div className='text-center mb-12'>
                        <h2 className='text-3xl font-bold tracking-tight text-foreground font-headline sm:text-4xl'>ทนายความแนะนำ</h2>
                        <p className="mt-2 text-muted-foreground">กำลังโหลดรายชื่อทนายความ...</p>
                        <Separator className='w-24 mx-auto mt-4 bg-border' />
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="w-full bg-gray-50 py-12 md:py-24 lg:py-32">
            <div className="container mx-auto px-4 md:px-6">
                <div className='text-center mb-12'>
                    <h2 className='text-3xl font-bold tracking-tight text-foreground font-headline sm:text-4xl'>ทนายความแนะนำ</h2>
                    <p className="mt-2 text-muted-foreground">ทนายความที่มีประสบการณ์และความเชี่ยวชาญเฉพาะด้าน</p>
                    <Separator className='w-24 mx-auto mt-4 bg-border' />
                </div>

                {lawyers.length > 0 ? (
                    <div className="max-w-5xl mx-auto flex flex-col gap-4">
                        {lawyers.map((lawyer) => (
                            <div key={lawyer.id} className="bg-white rounded-lg shadow-md">
                                <LawyerCard lawyer={lawyer} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground">
                        ไม่พบทนายความแนะนำในขณะนี้
                    </div>
                )}

                <div className="mt-12 text-center">
                    <Button asChild size="lg" variant="outline" className="bg-white">
                        <Link href={`/lawyers`}>ดูทนายความทั้งหมด</Link>
                    </Button>
                </div>

                {/* Homepage Banners Carousel - Client Side Fetching */}
                {/* Note: HomepageBannerWrapper is usually placed here in the parent, 
            but we can leave it in the parent or move it here if it's part of this section. 
            For now, I'll assume the parent handles the banner wrapper to keep this component focused.
        */}
            </div>
        </section>
    );
}
