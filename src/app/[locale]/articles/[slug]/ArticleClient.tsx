'use client'

import { getAllArticles } from '@/lib/data';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { useEffect, useState } from 'react';
import { Article } from '@/lib/types';
import { format } from 'date-fns';
import { th, enUS, zhCN } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { ShareButtons } from '@/components/share-buttons';
import { ArticleComments } from '@/components/article-comments';

interface ArticleClientProps {
    initialArticle: Article;
    slug: string;
}

export default function ArticleClient({ initialArticle, slug }: ArticleClientProps) {
    const { firestore } = useFirebase();
    const [article, setArticle] = useState<Article>(initialArticle);
    const [otherArticles, setOtherArticles] = useState<Article[]>([]);
    const [isLoadingOther, setIsLoadingOther] = useState(true);
    const locale = useLocale();
    const t = useTranslations('HomePage.articles');

    useEffect(() => {
        async function fetchOtherArticles() {
            if (!firestore) return;
            try {
                const allArticles = await getAllArticles(firestore);
                const other = allArticles.filter(a => a.slug !== slug).slice(0, 3);
                setOtherArticles(other);
            } catch (error) {
                console.error("Error fetching other articles:", error);
            } finally {
                setIsLoadingOther(false);
            }
        }
        fetchOtherArticles();
    }, [firestore, slug]);

    // Determine content based on locale
    let title = article.title;
    let description = article.description;
    let content = article.content;

    if (locale === 'en' && article.translations?.en) {
        title = article.translations.en.title || title;
        description = article.translations.en.description || description;
        content = article.translations.en.content || content;
    } else if (locale === 'zh' && article.translations?.zh) {
        title = article.translations.zh.title || title;
        description = article.translations.zh.description || description;
        content = article.translations.zh.content || content;
    }

    const dateLocale = locale === 'en' ? enUS : locale === 'zh' ? zhCN : th;

    return (
        <div className="bg-white">
            <div className="container mx-auto px-4 md:px-6 py-12">
                <div className="max-w-6xl mx-auto">
                    <Link href="/articles" className="text-sm text-foreground/80 hover:text-foreground mb-6 inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> {t('viewAll')}
                    </Link>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                        {/* Main Article Content */}
                        <article className="lg:col-span-2">
                            <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden mb-6 shadow-lg">
                                <Image
                                    src={article.imageUrl}
                                    alt={title}
                                    fill
                                    className="object-cover"
                                    data-ai-hint={article.imageHint}
                                    priority
                                />
                            </div>

                            <header className="mb-8">
                                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-headline mb-4">
                                    {title}
                                </h1>
                                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src="https://picsum.photos/seed/author-avatar/40/40" />
                                            <AvatarFallback>Law</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold text-foreground">{article.authorName || 'ทีมงาน Lawslane'}</p>
                                            <p>{t('publishedAt')}: {article.publishedAt ? format(new Date(article.publishedAt), 'd MMMM yyyy', { locale: dateLocale }) : 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            </header>

                            <div
                                className="prose prose-lg max-w-none text-foreground/90"
                                style={{
                                    // @ts-ignore
                                    '--tw-prose-body': 'hsl(var(--foreground) / 0.9)',
                                    '--tw-prose-headings': 'hsl(var(--foreground))',
                                    '--tw-prose-lead': 'hsl(var(--foreground))',
                                    '--tw-prose-links': 'hsl(var(--primary))',
                                    '--tw-prose-bold': 'hsl(var(--foreground))',
                                    '--tw-prose-counters': 'hsl(var(--muted-foreground))',
                                    '--tw-prose-bullets': 'hsl(var(--border))',
                                    '--tw-prose-hr': 'hsl(var(--border))',
                                    '--tw-prose-quotes': 'hsl(var(--foreground))',
                                    '--tw-prose-quote-borders': 'hsl(var(--border))',
                                    '--tw-prose-captions': 'hsl(var(--muted-foreground))',
                                    '--tw-prose-code': 'hsl(var(--foreground))',
                                    '--tw-prose-pre-code': 'hsl(var(--card-foreground))',
                                    '--tw-prose-pre-bg': 'hsl(var(--card))',
                                    '--tw-prose-th-borders': 'hsl(var(--border))',
                                    '--tw-prose-td-borders': 'hsl(var(--border))',
                                }}
                            >
                                <p className="lead">{description}</p>
                                {content.split('\n\n').map((paragraph, index) => {
                                    if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                                        return <h2 key={index} className="text-2xl font-semibold mt-8 mb-4">{paragraph.replaceAll('**', '')}</h2>
                                    }
                                    return <p key={index} className="mb-4">{paragraph}</p>
                                })}
                            </div>

                            <div className="mt-12 pt-8 border-t border-slate-100 italic">
                                <ShareButtons
                                    title={title}
                                    description={description}
                                    className="justify-end"
                                />
                            </div>

                            {/* Comments Section */}
                            <ArticleComments articleId={article.id} />

                            {/* CTA Button */}
                            {article.cta?.enabled && article.cta.text && article.cta.url && (
                                <div className="mt-8 p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <p className="text-lg font-semibold text-foreground">ต้องการความช่วยเหลือทางกฎหมาย?</p>
                                        <Link href={article.cta.url}>
                                            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white font-semibold px-8">
                                                {article.cta.text}
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </article>

                        {/* Other Articles Sidebar */}
                        <aside className="lg:col-span-1 space-y-6">
                            <h2 className="text-2xl font-bold font-headline">{t('title')}</h2>
                            <div className="space-y-4">
                                {isLoadingOther ? (
                                    <p>Loading...</p>
                                ) : otherArticles.map((other) => {
                                    let otherTitle = other.title;
                                    if (locale === 'en' && other.translations?.en) otherTitle = other.translations.en.title || otherTitle;
                                    else if (locale === 'zh' && other.translations?.zh) otherTitle = other.translations.zh.title || otherTitle;

                                    return (
                                        <Link key={other.id} href={`/articles/${other.slug}`} className="block group">
                                            <Card className="overflow-hidden transition-shadow hover:shadow-md">
                                                <div className="flex items-center gap-4 p-3">
                                                    <div className="relative w-24 h-24 flex-shrink-0">
                                                        <Image
                                                            src={other.imageUrl}
                                                            alt={otherTitle}
                                                            fill
                                                            className="object-cover rounded-md"
                                                            data-ai-hint={other.imageHint}
                                                        />
                                                    </div>
                                                    <div className="flex-grow">
                                                        <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                                            {otherTitle}
                                                        </h3>
                                                        <p className="text-xs text-muted-foreground mt-2">{other.publishedAt ? format(new Date(other.publishedAt), 'd MMM yy', { locale: dateLocale }) : ''}</p>
                                                    </div>
                                                </div>
                                            </Card>
                                        </Link>
                                    )
                                })}
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        </div>
    );
}
