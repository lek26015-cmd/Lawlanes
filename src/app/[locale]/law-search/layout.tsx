import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

// page.tsx เป็น client component ใส่ metadata ไม่ได้ — ใส่ที่ layout แทน
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    return pageMetadata(locale, 'lawSearch', '/law-search');
}

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
