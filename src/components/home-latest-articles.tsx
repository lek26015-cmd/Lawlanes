'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { getAllArticles } from '@/lib/data';
import { Article } from '@/lib/types';

export function HomeLatestArticles() {
    const { firestore } = useFirebase();
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchArticles() {
            if (!firestore) return;
            try {
                const fetchedArticles = await getAllArticles(firestore);
                setArticles(fetchedArticles.slice(0, 5));
            } catch (error) {
                console.error("Error fetching articles:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchArticles();
    }, [firestore]);

    if (loading) {
        return (
            <section id="articles" className="w-full py-12 md:py-24 lg:py-32 bg-white">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="flex justify-between items-center mb-12">
                        <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline text-foreground">
                            บทความกฎหมายน่ารู้
                        </h2>
                    </div>
                    <p>กำลังโหลดบทความ...</p>
                </div>
            </section>
        );
    }

    const mainArticle = articles[0];
    const otherArticles = articles.slice(1, 5);

    return (
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
                                    <p className="text-muted-foreground text-sm mt-2 line-clamp-2">{mainArticle.description}</p>
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
                                            <h4 className="font-semibold leading-snug group-hover:text-primary line-clamp-2">{article.title}</h4>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p>ไม่พบบทความ</p>
                )}

            </div>
        </section>
    );
}
