'use client';

import { Crown, LogIn, ShieldAlert } from 'lucide-react';
import { Link, usePathname } from '@/navigation';
import { Button } from '@/components/ui/button';

export type LockedStatus = 'unauthenticated' | 'not-lawyer' | 'upgrade-required';

/** สถานะที่ server action ตอบกลับมาแล้วต้องเปลี่ยนเป็นหน้าล็อก (เช่น แพลนหมดอายุระหว่างใช้งาน) */
export function isLockedStatus(status: string): status is LockedStatus {
    return status === 'unauthenticated' || status === 'not-lawyer' || status === 'upgrade-required';
}

// ด่านจริงอยู่ที่ server (lib/lawyer-plan-access) — ตัวนี้แค่บอกผู้ใช้ว่าต้องทำอะไรต่อ
export function LawyerProLocked({ status, feature }: { status: LockedStatus; feature: string }) {
    const pathname = usePathname();

    const content = status === 'upgrade-required'
        ? {
            icon: <Crown className="w-10 h-10 text-amber-500" />,
            title: `แพลนปัจจุบันของคุณยังไม่รวม${feature}`,
            desc: 'อัปเกรดแพลนเพื่อใช้งานส่วนนี้ ข้อมูลที่เคยสร้างไว้ยังอยู่ครบ และจะกลับมาแสดงเมื่อแพลนของคุณมีสิทธิ์นี้อีกครั้ง',
            action: (
                <Button asChild className="rounded-full bg-amber-500 hover:bg-amber-600 text-white">
                    <Link href="/lawyer-dashboard/plan">ดูแพลน</Link>
                </Button>
            ),
        }
        : status === 'not-lawyer'
            ? {
                icon: <ShieldAlert className="w-10 h-10 text-slate-400" />,
                title: 'หน้านี้ใช้ได้เฉพาะบัญชีทนาย',
                desc: 'ฟีเจอร์นี้อยู่ในหลังบ้านของทนายความ',
                action: (
                    <Button asChild variant="outline" className="rounded-full">
                        <Link href="/for-lawyers">สมัครเป็นทนายกับ Lawslane</Link>
                    </Button>
                ),
            }
            : {
                icon: <LogIn className="w-10 h-10 text-blue-500" />,
                title: 'เข้าสู่ระบบทนายเพื่อใช้งาน',
                desc: 'ฟีเจอร์นี้ใช้ได้เฉพาะบัญชีทนายความ',
                action: (
                    <Button asChild className="rounded-full bg-[#002f4b] hover:bg-[#00243a]">
                        <Link href={`/lawyer-login?redirect=${encodeURIComponent(pathname)}`}>เข้าสู่ระบบ</Link>
                    </Button>
                ),
            };

    return (
        <div className="text-center py-14 px-6 bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border shadow-sm">
            <div className="flex justify-center mb-4">{content.icon}</div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-foreground mb-2">{content.title}</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-6">{content.desc}</p>
            {content.action}
        </div>
    );
}
