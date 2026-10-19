import Image from 'next/image';
import { useTranslations } from 'next-intl';
import searchLawyerImg from '@/pic/search-lawyer.webp';
import logoWhite from '@/pic/logo-lawslane-transparent-white.png';

// แบนเนอร์หน้า /lawyers — ข้อความเป็นตัวอักษรจริง (h1) ไม่ฝังในรูป: Google อ่านได้ และแปลได้ทุกภาษา
// ใช้ทั้งใน LawyersPageClient และเป็น Suspense fallback ใน page.tsx
// (หน้า client ใช้ useSearchParams จึงเรนเดอร์ฝั่ง browser — fallback ทำให้ HTML แรกมีหัวเรื่องจริง)
export function LawyersHero() {
    const t = useTranslations('Lawyers');
    return (
        // พื้น slate-900 เดียวกับ hero หน้าแรก/หน้าตรวจสอบทนาย — รูปเป็น PNG พื้นใส ชิดขอบซ้าย/ล่างของการ์ด (padding อยู่ที่คอลัมน์ข้อความเท่านั้น)
        <div className="relative overflow-hidden text-left rounded-[2rem] md:rounded-[2.5rem] bg-slate-900 text-white shadow-xl">
            <div className="relative flex flex-col-reverse md:flex-row-reverse md:items-end gap-4 md:gap-8 pt-8 md:pt-10">
                <div className="md:flex-1 px-6 md:pl-0 md:pr-12 pb-8 md:pb-12 space-y-3 md:self-center">
                    <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight font-headline text-white leading-tight text-balance">
                        {t('heroTitle')}
                    </h1>
                    <p className="text-base md:text-lg text-gray-400 leading-relaxed max-w-md">
                        {t('heroSubtitle')}
                    </p>
                </div>
                <div className="relative md:w-[46%] md:shrink-0">
                    {/* ฉากหลังตัวละคร — แสงนวลสีน้ำเงิน + โลโก้จางลงล่าง ให้หัวที่สว่างกลืนกับพื้นมืด (ไม่ลอยเป็นภาพตัดแปะ) */}
                    <div className="absolute left-[2%] top-[4%] w-[62%] h-[80%] rounded-full bg-[#1a5bb8]/35 blur-3xl pointer-events-none" />
                    <div className="absolute left-[22%] -top-[14%] h-[100%] aspect-[711/994] opacity-30 pointer-events-none [mask-image:linear-gradient(to_bottom,black_30%,transparent_85%)]">
                        <Image src={logoWhite} alt="" fill sizes="200px" className="object-contain" />
                    </div>
                    <Image
                        src={searchLawyerImg}
                        alt={t('heroImageAlt')}
                        priority
                        sizes="(max-width: 768px) 100vw, 560px"
                        className="relative w-full h-auto [mask-image:linear-gradient(to_bottom,black_80%,transparent)] md:[mask-image:none]"
                    />
                </div>
            </div>
        </div>
    );
}
