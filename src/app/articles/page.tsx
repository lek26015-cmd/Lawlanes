'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAllArticles } from '@/lib/data';
import type { Article } from '@/lib/types';
import { ArrowRight, Newspaper } from 'lucide-react';

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchArticles() {
      setIsLoading(true);
      const allArticles = await getAllArticles();
      setArticles(allArticles);
      setIsLoading(false);
    }
    fetchArticles();
  }, []);

  return (
    <div className="container mx-auto px-4 md:px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl font-headline text-foreground">
          บทความกฎหมายน่ารู้
        </h1>
        <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
          อัปเดตความรู้ทางกฎหมายสำหรับธุรกิจของคุณ
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-96"></div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map((article) => (
            <Card key={article.id} className="overflow-hidden h-full flex flex-col">
              <Link href={`/articles/${article.slug}`} className="block">
                <div className="relative h-48 w-full">
                  <Image
                    src={article.imageUrl}
                    alt={article.title}
                    fill
                    className="object-cover"
                    data-ai-hint={article.imageHint}
                  />
                </div>
              </Link>
              <CardHeader>
                <CardTitle>
                  <Link href={`/articles/${article.slug}`} className="hover:text-primary-foreground transition-colors">
                    {article.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <CardDescription>{article.description}</CardDescription>
              </CardContent>
              <div className="p-6 pt-0">
                <Link href={`/articles/${article.slug}`}>
                  <Button variant="link" className="p-0">
                    อ่านต่อ <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
