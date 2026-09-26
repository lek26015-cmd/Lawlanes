/**
 * โครงเอกสารกฎหมาย (ข้อกำหนด / นโยบายความเป็นส่วนตัว / คุกกี้) — เนื้อหาแยกต่อภาษา
 * render โดย components/legal/legal-document.tsx
 *
 * ข้อความ inline รองรับ:
 *   **ตัวหนา**
 *   [ข้อความ](/path)            ลิงก์ในเว็บ (เติม locale ให้เอง) หรือ mailto:/https:
 *   [[ข้อมูลที่ยังต้องกรอก]]      ไฮไลต์เป็นช่องว่างให้เติมก่อนเผยแพร่ (ชื่อบริษัท ที่อยู่ ฯลฯ)
 */

export type LegalLocale = 'th' | 'en' | 'zh';

export type LegalBlock =
    | { p: string }
    | { ul: string[] }
    | { table: { head: string[]; rows: string[][] } };

export type LegalSection = {
    id: string;
    title: string;
    blocks: LegalBlock[];
};

export type LegalDoc = {
    title: string;
    intro: string[];
    sections: LegalSection[];
};
