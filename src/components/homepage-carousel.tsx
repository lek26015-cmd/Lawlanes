'use client';

import * as React from 'react';
import Image from 'next/image';
import Autoplay from 'embla-carousel-autoplay';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { Ad } from '@/lib/types';

interface HomepageCarouselProps {
    banners: Ad[];
}

export function HomepageCarousel({ banners }: HomepageCarouselProps) {
    const plugin = React.useRef(
        Autoplay({ delay: 4000, stopOnInteraction: true })
    );

    if (!banners || banners.length === 0) {
        return null;
    }

    return (
        <Carousel
            plugins={[plugin.current]}
            className="w-full max-w-5xl mx-auto"
            onMouseEnter={plugin.current.stop}
            onMouseLeave={plugin.current.reset}
        >
            <CarouselContent>
                {banners.map((banner) => (
                    <CarouselItem key={banner.id}>
                        <div className="p-1">
                            {banner.href ? (
                                <a href={banner.href} target="_blank" rel="noopener noreferrer" className="block">
                                    <Card className="border-0 shadow-lg overflow-hidden rounded-xl hover:opacity-95 transition-opacity">
                                        <CardContent className="flex aspect-[21/9] items-center justify-center p-0 relative">
                                            <Image
                                                src={banner.imageUrl}
                                                alt={banner.title}
                                                fill
                                                className="object-cover"
                                                priority
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-6 text-white">
                                                <h3 className="text-2xl font-bold mb-2">{banner.title}</h3>
                                                <p className="text-sm md:text-base opacity-90">{banner.description}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </a>
                            ) : (
                                <Card className="border-0 shadow-lg overflow-hidden rounded-xl">
                                    <CardContent className="flex aspect-[21/9] items-center justify-center p-0 relative">
                                        <Image
                                            src={banner.imageUrl}
                                            alt={banner.title}
                                            fill
                                            className="object-cover"
                                            priority
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-6 text-white">
                                            <h3 className="text-2xl font-bold mb-2">{banner.title}</h3>
                                            <p className="text-sm md:text-base opacity-90">{banner.description}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious className="left-4" />
            <CarouselNext className="right-4" />
        </Carousel>
    );
}
