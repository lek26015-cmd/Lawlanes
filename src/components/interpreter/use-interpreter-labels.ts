'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { InterpreterBookingStatus, InterpreterLanguageCode, InterpreterService, PublicInterpreter } from '@/lib/interpreter-types';

/** ชื่อภาษา/บริการ/สถานะตามภาษาของหน้า + คำอธิบายโปรไฟล์ตาม locale */
export function useInterpreterLabels() {
    const t = useTranslations('Interpreters');
    const locale = useLocale();
    return {
        language: (code: InterpreterLanguageCode | string) => t(`languageNames.${code}` as any),
        service: (s: InterpreterService | string) => t(`serviceNames.${s}` as any),
        level: (l: string) => t(`levelNames.${l}` as any),
        unit: (u: string) => t(`unitNames.${u}` as any),
        /** "฿1,500 / ชม." */
        rate: (price: number, unit: string) => `฿${price.toLocaleString(locale === 'th' ? 'th-TH' : locale, { maximumFractionDigits: 2 })} ${t(`unitSuffix.${unit}` as any)}`,
        status: (s: InterpreterBookingStatus | string) => t(`statusNames.${s}` as any),
        description: (i: Pick<PublicInterpreter, 'description' | 'descriptionEn' | 'descriptionZh'>) =>
            (locale === 'en' && i.descriptionEn) || (locale === 'zh' && i.descriptionZh) || i.description,
        money: (baht: number) => baht.toLocaleString(locale === 'th' ? 'th-TH' : locale, { maximumFractionDigits: 2 }),
        satang: (satang: number) => (satang / 100).toLocaleString(locale === 'th' ? 'th-TH' : locale, { maximumFractionDigits: 2 }),
        dateTime: (isoStr: string) => new Date(isoStr).toLocaleString(locale === 'th' ? 'th-TH' : locale, {
            timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short',
        }),
    };
}
