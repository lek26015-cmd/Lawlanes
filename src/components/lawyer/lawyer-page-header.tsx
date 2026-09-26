import React from 'react';
import { Link } from '@/navigation';
import { ArrowLeft } from 'lucide-react';

type Props = {
    icon?: React.ElementType;
    title: React.ReactNode;
    description?: React.ReactNode;
    /** ปุ่มด้านขวา */
    actions?: React.ReactNode;
    /** ลิงก์ย้อนกลับ (หน้าย่อย เช่น รายละเอียดเคส) */
    back?: { href: string; label: string };
};

// หัวหน้ามาตรฐานของหลังบ้านทนาย — ใช้แบบเดียวกันทุกหน้า
export default function LawyerPageHeader({ icon: Icon, title, description, actions, back }: Props) {
    return (
        <div className="space-y-3">
            {back && (
                <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#002f4b] dark:hover:text-blue-300 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    {back.label}
                </Link>
            )}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    {Icon && (
                        <div className="shrink-0 w-11 h-11 rounded-xl bg-[#002f4b] text-white flex items-center justify-center shadow-sm">
                            <Icon className="w-5 h-5" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{title}</h1>
                        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
                    </div>
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
            </div>
        </div>
    );
}

// สถานะกำลังโหลดแบบเดียวกันทุกหน้า
export function LawyerPageLoading() {
    return (
        <div className="flex items-center justify-center py-32">
            <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-[#002f4b] animate-spin" />
        </div>
    );
}
