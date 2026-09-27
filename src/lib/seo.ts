import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { locales } from '@/navigation';

// โดเมนจริงคือ www และทุกหน้ามี locale นำหน้า (localePrefix: 'always')
export const SITE_URL = 'https://www.lawslane.com';

/** canonical ของหน้านี้ + hreflang ของทุกภาษา (x-default = th) — path เช่น '' หรือ '/lawyers' */
export function localeAlternates(locale: string, path: string): Metadata['alternates'] {
    return {
        canonical: `${SITE_URL}/${locale}${path}`,
        languages: {
            ...Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}${path}`])),
            'x-default': `${SITE_URL}/th${path}`,
        },
    };
}

/** title/description จาก messages Seo.<key> + canonical/hreflang */
export async function pageMetadata(locale: string, key: string, path: string): Promise<Metadata> {
    const t = await getTranslations({ locale, namespace: 'Seo' });
    const title = t(`${key}.title`);
    const description = t(`${key}.description`);
    return {
        title,
        description,
        alternates: localeAlternates(locale, path),
        // openGraph ของหน้าลูกทับของ layout ทั้งก้อน → ต้องใส่รูปซ้ำ
        openGraph: {
            title,
            description,
            url: `${SITE_URL}/${locale}${path}`,
            images: [{ url: '/icon.jpg', width: 800, height: 800, alt: 'Lawslane Logo' }],
        },
    };
}
