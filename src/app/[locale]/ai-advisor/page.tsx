import { redirect } from '@/navigation';

// หน้า AI Legal Advisor เดิม — ย้ายไปเป็น Lawslane AI (/ai) แล้ว คงไว้ให้ลิงก์เก่ายังใช้ได้
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    redirect({ href: '/ai', locale });
}
