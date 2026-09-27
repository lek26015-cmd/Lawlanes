import { MetadataRoute } from 'next'
import { locales } from '@/navigation'

// โดเมนจริงคือ www (lawslane.com redirect มา www) และทุกหน้ามี locale นำหน้า (localePrefix: 'always')
// URL ที่ไม่มี /th จะโดน redirect — ใส่ URL ปลายทางตรง ๆ พร้อม hreflang ของอีกสองภาษา
const baseUrl = 'https://www.lawslane.com'

const pages: { path: string; changeFrequency: 'daily' | 'weekly' | 'monthly'; priority: number }[] = [
  { path: '', changeFrequency: 'daily', priority: 1 },
  { path: '/lawyers', changeFrequency: 'daily', priority: 0.9 },
  { path: '/interpreters', changeFrequency: 'daily', priority: 0.8 },
  { path: '/law-search', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/articles', changeFrequency: 'daily', priority: 0.7 },
  { path: '/forms', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/for-lawyers', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/for-interpreters', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/verify-lawyer', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/help', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/guide', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/ai-disclaimer', changeFrequency: 'monthly', priority: 0.2 },
  { path: '/privacy', changeFrequency: 'monthly', priority: 0.2 },
  { path: '/terms', changeFrequency: 'monthly', priority: 0.2 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return pages.map(({ path, changeFrequency, priority }) => ({
    url: `${baseUrl}/th${path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l, `${baseUrl}/${l}${path}`])),
    },
  }))
}
