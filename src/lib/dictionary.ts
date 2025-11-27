import 'server-only'

// กำหนดว่าเรามีภาษาอะไรบ้าง และไฟล์แปลภาษาอยู่ที่ไหน
const dictionaries = {
  en: () => import('@/dictionaries/en.json').then((module) => module.default),
  th: () => import('@/dictionaries/th.json').then((module) => module.default),
}

// ฟังก์ชันสำหรับเรียกใช้ dictionary ตามภาษาที่ส่งเข้ามา
export const getDictionary = async (locale: string) => {
  // ถ้าหาภาษาไม่เจอ ให้ใช้ภาษาอังกฤษ (en) เป็นค่าเริ่มต้น
  if (!dictionaries[locale as keyof typeof dictionaries]) {
      return dictionaries['en']();
  }
  return dictionaries[locale as keyof typeof dictionaries]()
}