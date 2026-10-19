import { redirect } from '@/navigation';

// ย้ายเข้าผู้ช่วย AI งานคดีในแดชบอร์ดทนาย (แพลน Pro/บริษัท) — คงไว้ให้ลิงก์เก่า/bookmark ยังใช้ได้
export default async function Page({ params, searchParams }: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ q?: string }>;
}) {
    const [{ locale }, { q }] = await Promise.all([params, searchParams]);
    const query = typeof q === 'string' && q ? `&q=${encodeURIComponent(q.slice(0, 2000))}` : '';
    redirect({ href: `/lawyer-dashboard/ai?mode=contract${query}`, locale });
}
