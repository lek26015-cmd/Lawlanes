import { getArticleBySlug } from '@/lib/data';
import { notFound } from 'next/navigation';
import { initializeFirebase } from '@/firebase';
import ArticleClient from './ArticleClient';
import { Metadata } from 'next';

type Props = {
  params: Promise<{ slug: string; locale: string }>
}

export async function generateMetadata(
  props: Props
): Promise<Metadata> {
  const params = await props.params;
  const { slug } = params;
  const { firestore } = initializeFirebase();
  
  if (!firestore) {
    return { title: 'Legal Case Room - Lawslane' };
  }
  
  const article = await getArticleBySlug(firestore, slug);

  if (!article) {
    return {
      title: 'Article Not Found - Lawslane',
    };
  }

  const title = `${article.title} - Lawslane`;
  const description = article.description || `อ่านบทความ ${article.title} บนระบบ Lawslane`;
  const imageUrl = article.imageUrl || 'https://lawslane.com/icon.jpg';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ArticlePage(props: Props) {
  const params = await props.params;
  const { slug } = params;
  const { firestore } = initializeFirebase();
  
  if (!firestore) {
    notFound();
  }
  
  const article = await getArticleBySlug(firestore, slug);

  if (!article) {
    notFound();
  }

  return <ArticleClient initialArticle={article} slug={slug} />;
}
