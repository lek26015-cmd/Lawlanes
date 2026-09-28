import Image from 'next/image';
import { useTranslations } from 'next-intl';
import searchLawyerImg from '@/pic/search-lawyer.webp';

// แบนเนอร์หน้า /lawyers — ข้อความเป็นตัวอักษรจริง (h1) ไม่ฝังในรูป: Google อ่านได้ และแปลได้ทุกภาษา
// ใช้ทั้งใน LawyersPageClient และเป็น Suspense fallback ใน page.tsx
// (หน้า client ใช้ useSearchParams จึงเรนเดอร์ฝั่ง browser — fallback ทำให้ HTML แรกมีหัวเรื่องจริง)
export function LawyersHero() {
    const t = useTranslations('Lawyers');
    return (
        <div className="relative overflow-hidden text-left border-b-4 border-[#0B3979]">
            <div className="flex flex-col-reverse md:flex-row md:items-end gap-4 md:gap-6">
                <div className="md:w-1/2 pb-6 md:pb-10 space-y-3">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight font-headline text-[#0B3979] leading-tight">
                        {t('heroTitle')}
                    </h1>
                    <p className="text-base md:text-lg text-slate-600 leading-relaxed max-w-md">
                        {t('heroSubtitle')}
                    </p>
                </div>
                <div className="md:w-1/2">
                    <Image
                        src={searchLawyerImg}
                        alt={t('heroImageAlt')}
                        priority
                        sizes="(max-width: 768px) 100vw, 560px"
                        className="w-full h-auto"
                    />
                </div>
            </div>
        </div>
    );
}
