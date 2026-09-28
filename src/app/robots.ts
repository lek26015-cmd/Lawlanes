import { MetadataRoute } from 'next'

// เปิดให้ search engine เก็บหน้าสาธารณะ — ปิดเฉพาะหน้าหลังบ้าน/หน้าส่วนตัว
// (เดิม disallow: '/' ตั้งแต่ lockdown เม.ย. 2026 → Google ขึ้นแค่ URL ไม่มีคำอธิบาย/โลโก้)
// ไฟล์นี้ชนะ public/robots.txt จึงลบไฟล์นั้นทิ้ง ให้เหลือที่เดียว
const PRIVATE_PATHS = [
  'admin', 'dashboard', 'account', 'chat', 'interpreter-chat', 'interpreter-dashboard',
  'dev', 'payment', 'vault', 'appointment', 'review', 'contract', 'support',
  'lawyer-dashboard', 'lawyer-login', 'lawyer-signup', 'lawyer-schedule',
  'login', 'signup', 'reset-password', 'registration-success', 'interpreter-payment',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // หน้าจอง/นัดของทนายและล่ามแต่ละคน (ต้องล็อกอิน มีข้อมูลที่ลูกความกรอก)
      disallow: ['/api/', ...PRIVATE_PATHS.map((p) => `/*/${p}`), '/*/interpreters/*/book', '/*/lawyers/*/schedule'],
    },
    sitemap: 'https://www.lawslane.com/sitemap.xml',
  }
}
