import { getArticleBySlug } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Calendar, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await getArticleBySlug(params.slug);

  if (!article) {
    notFound();
  }

  return (
    <div className="bg-white">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-20">
        <article className="max-w-4xl mx-auto">
          <Link href="/articles" className="text-sm text-foreground/80 hover:text-foreground mb-6 inline-block">
            &larr; กลับไปที่หน้ารวมบทความ
          </Link>

          <header className="mb-8">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter text-foreground font-headline mb-4">
              {article.title}
            </h1>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>เผยแพร่เมื่อ: 24 กรกฎาคม 2024 (ตัวอย่าง)</span>
              </div>
            </div>
          </header>

          <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden mb-8">
            <Image
              src={article.imageUrl}
              alt={article.title}
              fill
              className="object-cover"
              data-ai-hint={article.imageHint}
              priority
            />
          </div>

          <div 
            className="prose prose-lg max-w-none text-foreground"
            style={{
                // @ts-ignore
                '--tw-prose-body': 'hsl(var(--foreground))',
                '--tw-prose-headings': 'hsl(var(--foreground))',
                '--tw-prose-lead': 'hsl(var(--foreground))',
                '--tw-prose-links': 'hsl(var(--foreground))',
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
            <p className="lead">{article.description}</p>
            {article.content.split('\n\n').map((paragraph, index) => {
                if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                    return <h2 key={index} className="text-2xl font-semibold mt-8 mb-4">{paragraph.replaceAll('**','')}</h2>
                }
                 return <p key={index} className="mb-4">{paragraph}</p>
            })}
          </div>
        </article>
      </div>
    </div>
  );
}
