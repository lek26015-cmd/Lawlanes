
import { getArticleBySlug, getAllArticles } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await getArticleBySlug(params.slug);
  if (!article) {
    notFound();
  }

  // Fetch other articles for the sidebar, excluding the current one
  const allArticles = await getAllArticles();
  const otherArticles = allArticles.filter(a => a.slug !== params.slug).slice(0, 3);

  return (
    <div className="bg-white">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <Link href="/articles" className="text-sm text-foreground/80 hover:text-foreground mb-6 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> กลับไปหน้าบทความ
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* Main Article Content */}
            <article className="lg:col-span-2">
              <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden mb-6 shadow-lg">
                <Image
                  src={article.imageUrl}
                  alt={article.title}
                  fill
                  className="object-cover"
                  data-ai-hint={article.imageHint}
                  priority
                />
              </div>

              <header className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-headline mb-4">
                  {article.title}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="https://picsum.photos/seed/author-avatar/40/40" />
                      <AvatarFallback>ทน</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground">ทีมงาน ContestOne (จำลอง)</p>
                      <p>เผยแพร่เมื่อ: 18 กรกฎาคม 2024 (ตัวอย่าง)</p>
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
                <p className="lead">{article.description}</p>
                {article.content.split('\n\n').map((paragraph, index) => {
                    if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                        return <h2 key={index} className="text-2xl font-semibold mt-8 mb-4">{paragraph.replaceAll('**','')}</h2>
                    }
                     return <p key={index} className="mb-4">{paragraph}</p>
                })}
              </div>
            </article>

            {/* Other Articles Sidebar */}
            <aside className="lg:col-span-1 space-y-6">
              <h2 className="text-2xl font-bold font-headline">บทความอื่น ๆ</h2>
              <div className="space-y-4">
                {otherArticles.map((other) => (
                  <Link key={other.id} href={`/articles/${other.slug}`} className="block group">
                    <Card className="overflow-hidden transition-shadow hover:shadow-md">
                      <div className="flex items-center gap-4 p-3">
                        <div className="relative w-24 h-24 flex-shrink-0">
                          <Image 
                            src={other.imageUrl} 
                            alt={other.title} 
                            fill
                            className="object-cover rounded-md"
                            data-ai-hint={other.imageHint}
                          />
                        </div>
                        <div className="flex-grow">
                          <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors">
                            {other.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-2">20 ก.ค. 24 (ตัวอย่าง)</p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
