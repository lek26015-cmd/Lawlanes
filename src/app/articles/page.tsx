'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAllArticles } from '@/lib/data';
import type { Article } from '@/lib/types';
import { ArrowRight, Search, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    async function fetchArticles() {
      setIsLoading(true);
      const allArticles = await getAllArticles();
      setArticles(allArticles);
      setIsLoading(false);
    }
    fetchArticles();
  }, []);

  const categories = useMemo(() => {
    const allCategories = articles.map(article => article.category);
    return ['all', ...Array.from(new Set(allCategories))];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
      const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) || article.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [articles, searchTerm, selectedCategory]);

  return (
    <div className="container mx-auto px-4 md:px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl font-headline text-foreground">
          บทความหน้ารู้
        </h1>
        <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
          สาระความรู้ทางกฎหมายที่น่าสนใจสำหรับ SME และบุคคลทั่วไป
        </p>
      </div>

      <div className="max-w-3xl mx-auto mb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-4 border rounded-lg bg-card">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="ค้นหาบทความ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 h-12"
            />
          </div>
          <div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="ทุกหมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category === 'all' ? 'ทุกหมวดหมู่' : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="flex flex-col">
              <div className="animate-pulse bg-gray-200 h-48 w-full"></div>
              <CardHeader>
                <div className="animate-pulse bg-gray-200 h-6 w-3/4 rounded"></div>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="animate-pulse bg-gray-200 h-4 w-full rounded mb-2"></div>
                <div className="animate-pulse bg-gray-200 h-4 w-5/6 rounded"></div>
              </CardContent>
              <div className="p-6 pt-0">
                <div className="animate-pulse bg-gray-200 h-5 w-20 rounded-full"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredArticles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredArticles.map((article) => (
            <Card key={article.id} className="overflow-hidden h-full flex flex-col group">
              <Link href={`/articles/${article.slug}`} className="block">
                <div className="relative h-48 w-full">
                  <Image
                    src={article.imageUrl}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    data-ai-hint={article.imageHint}
                  />
                  <div className="absolute inset-0 bg-black/20"></div>
                  <Badge variant="secondary" className="absolute top-3 right-3">{article.category}</Badge>
                </div>
              </Link>
              <CardHeader>
                <CardTitle>
                  <Link href={`/articles/${article.slug}`} className="hover:text-primary transition-colors">
                    {article.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <CardDescription>{article.description}</CardDescription>
              </CardContent>
              <div className="p-6 pt-0">
                <Link href={`/articles/${article.slug}`}>
                  <Button variant="link" className="p-0 text-foreground">
                    อ่านต่อ <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">ไม่พบบทความ</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            ลองเปลี่ยนคำค้นหาหรือตัวกรองหมวดหมู่ของคุณ
          </p>
        </div>
      )}
    </div>
  );
}
