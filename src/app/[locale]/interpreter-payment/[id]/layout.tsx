import type { Metadata } from 'next';

// ลิงก์ชำระเงินรายคน — ไม่ให้ search engine เก็บ (robots.ts ปิดไว้ด้วย)
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
