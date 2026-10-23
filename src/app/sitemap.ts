import { MetadataRoute } from 'next'
import { locales } from '@/navigation'
import { SITE_URL } from '@/lib/seo'
import { getApprovedLawyersAction } from '@/app/actions/lawyer-directory-actions'
import { listPublishedLawyerSlugs } from '@/lib/landing-page-server'
import { initAdmin } from '@/lib/firebase-admin'

// โดเมนจริงคือ www (lawslane.com redirect มา www) และทุกหน้ามี locale นำหน้า (localePrefix: 'always')
// URL ที่ไม่มี /th จะโดน redirect — ใส่ URL ปลายทางตรง ๆ พร้อม hreflang ของอีกสองภาษา
const baseUrl = SITE_URL

const pages: { path: string; changeFrequency: 'daily' | 'weekly' | 'monthly'; priority: number }[] = [
  { path: '', changeFrequency: 'daily', priority: 1 },
  { path: '/lawyers', changeFrequency: 'daily', priority: 0.9 },
  { path: '/interpreters', changeFrequency: 'daily', priority: 0.8 },
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

  // บทความแต่ละเรื่อง — หน้า /articles/[slug] เปิดได้ทุกเอกสารที่มี slug (ไม่มีสถานะฉบับร่าง)
  let articlePages: MetadataRoute.Sitemap = []
  try {
    const adminApp = await initAdmin()
    if (adminApp) {
      const snap = await adminApp.firestore().collection('articles').select('slug', 'publishedAt', 'updatedAt').get()
      articlePages = snap.docs.flatMap((doc) => {
        const { slug, publishedAt, updatedAt } = doc.data()
        if (typeof slug !== 'string' || !slug.trim()) return []
        return [localized(`/articles/${encodeURIComponent(slug)}`, toDate(updatedAt) ?? toDate(publishedAt) ?? lastModified, 'monthly', 0.6)]
      })
    }
  } catch (error) {
    console.error('[sitemap] articles failed', error)
  }

  return [...staticPages, ...lawyerPages, ...landingPages, ...articlePages]
}

// publishedAt/updatedAt เก็บได้ทั้ง Timestamp, Date และ string แล้วแต่ว่าบันทึกมาจากไหน
function toDate(value: unknown): Date | undefined {
  if (!value) return undefined
  const date = typeof (value as { toDate?: unknown }).toDate === 'function'
    ? (value as { toDate: () => Date }).toDate()
    : new Date(value as string | Date)
  return isNaN(date.getTime()) ? undefined : date
}

