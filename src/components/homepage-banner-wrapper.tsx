'use client';

import * as React from 'react';
import { useFirebase } from '@/firebase/provider';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { HomepageCarousel } from '@/components/homepage-carousel';
import { Ad } from '@/lib/types';

export function HomepageBannerWrapper() {
    const { firestore } = useFirebase();
    const [banners, setBanners] = React.useState<Ad[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!firestore) return;

        const fetchBanners = async () => {
            try {
                const adsRef = collection(firestore, 'ads');
                const q = query(
                    adsRef,
                    where('placement', '==', 'Homepage Carousel'),
                    where('status', '==', 'active')
                );
                const snapshot = await getDocs(q);
                const fetchedBanners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
                setBanners(fetchedBanners);
            } catch (error) {
                console.error("Error fetching homepage banners:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBanners();
    }, [firestore]);

    if (loading) {
        return null; // Or a skeleton loader if preferred
    }

    if (banners.length === 0) {
        return null;
    }

    return (
        <div className="mt-16">
            <HomepageCarousel banners={banners} />
        </div>
    );
}
