import { MetadataRoute } from 'next'
import { locales } from '@/navigation'
import { SITE_URL } from '@/lib/seo'
import { getApprovedLawyersAction } from '@/app/actions/lawyer-directory-actions'
import { listPublishedLawyerSlugs } from '@/lib/landing-page-server'

// โดเมนจริงคือ www (lawslane.com redirect มา www) และทุกหน้ามี locale นำหน้า (localePrefix: 'always')
// URL ที่ไม่มี /th จะโดน redirect — ใส่ URL ปลายทางตรง ๆ พร้อม hreflang ของอีกสองภาษา
const baseUrl = SITE_URL

const pages: { path: string; changeFrequency: 'daily' | 'weekly' | 'monthly'; priority: number }[] = [
  { path: '', changeFrequency: 'daily', priority: 1 },
  { path: '/lawyers', changeFrequency: 'daily', priority: 0.9 },
  { path: '/interpreters', changeFrequency: 'daily', priority: 0.8 },
  { path: '/law-search', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/articles', changeFrequency: 'daily', priority: 0.7 },
  { path: '/forms', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/for-lawyers', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/verify-lawyer', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/help', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/ai-disclaimer', changeFrequency: 'monthly', priority: 0.2 },
  { path: '/privacy', changeFrequency: 'monthly', priority: 0.2 },
  { path: '/terms', changeFrequency: 'monthly', priority: 0.2 },
]

// รายชื่อทนายเปลี่ยนได้ทุกวัน — สร้าง sitemap ใหม่อย่างมากวันละครั้ง
export const revalidate = 86400

function localized(path: string, lastModified: Date, changeFrequency: 'daily' | 'weekly' | 'monthly', priority: number) {
  return {
    url: `${baseUrl}/th${path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l, `${baseUrl}/${l}${path}`])),
    },
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()
  const staticPages = pages.map(({ path, changeFrequency, priority }) => localized(path, lastModified, changeFrequency, priority))

  // โปรไฟล์ทนายที่อนุมัติแล้วเท่านั้น (หน้าโปรไฟล์ของ status อื่นเป็น 404) — ทนายจากทะเบียนไม่มีหน้าของตัวเอง
  let lawyerPages: MetadataRoute.Sitemap = []
  try {
    const lawyers = await getApprovedLawyersAction(1000)
    lawyerPages = lawyers.map((l) => localized(`/lawyers/${l.id}`, lastModified, 'weekly', 0.6))
  } catch (error) {
    console.error('[sitemap] lawyers failed', error)
  }

  // หน้าเว็บส่วนตัวของทนาย (แพลน Pro/บริษัท ที่เผยแพร่อยู่)
  let landingPages: MetadataRoute.Sitemap = []
  try {
    const slugs = await listPublishedLawyerSlugs()
    landingPages = slugs.map((slug) => localized(`/p/${slug}`, lastModified, 'weekly', 0.6))
  } catch (error) {
    console.error('[sitemap] landing pages failed', error)
  }

  return [...staticPages, ...lawyerPages, ...landingPages]
}

