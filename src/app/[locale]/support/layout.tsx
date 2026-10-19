import type { Metadata } from 'next';
import React from 'react';

// หน้านี้ผูกกับผู้ใช้/เคสหรือเป็นลิงก์แชร์ — ห้าม search engine เก็บ (ดู src/app/robots.ts ด้วย)
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
