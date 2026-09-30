'use client';

import React from 'react';
import LawyerSidebar from '@/components/layout/lawyer-sidebar';
import { usePathname } from '@/navigation';

// โครงเดียวของทุกหน้าในหลังบ้านทนาย: sidebar (จอใหญ่) / แถบบน + เมนูสไลด์ (มือถือ)
// เดิมมีแค่ 4 หน้าที่ใส่ sidebar เอง อีก 7 หน้าไม่มีเมนูเลย (header เว็บหลักถูกซ่อนในหน้า dashboard)
export default function LawyerShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    // ผู้ช่วย AI งานคดีเป็นหน้าทำงานเต็มจอ (มีแฟ้มคดีของตัวเองด้านซ้าย + ปุ่มกลับแดชบอร์ด) — sidebar ซ้อนกันสองชั้นดูรก
    if (pathname.endsWith('/lawyer-dashboard/ai')) {
        return <div className="h-dvh overflow-hidden bg-white dark:bg-background">{children}</div>;
    }
    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-background">
            <LawyerSidebar />
            <main className="flex-1 min-w-0 overflow-y-auto">
                <div className="mx-auto w-full max-w-7xl px-4 md:px-8 pt-20 md:pt-24 lg:pt-8 pb-12 space-y-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
