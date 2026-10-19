'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/**
 * รูปโปรไฟล์มีวงสี + ป้ายชื่อแพลน — หน้าตาเดียวกันทุกเว็บในเครือ Lawslane
 * (Lawslane, CapDeal, Wittaya, Business ใช้ไฟล์นี้ชุดเดียวกัน แก้สีต้องแก้ทุก repo)
 *   none    = แพลนฟรี ไม่มีวงและป้าย
 *   plus    = แพลนจ่ายขั้นแรก (ฟ้า→ม่วง)
 *   gold    = แพลนกลาง (ทอง)
 *   premium = แพลนสูงสุด (ทองเข้ม→ส้ม ป้ายพื้นดำ)
 */
export type PlanTone = 'none' | 'plus' | 'gold' | 'premium';

const RING: Record<PlanTone, string> = {
    none: '',
    plus: 'bg-gradient-to-tr from-sky-400 via-blue-500 to-violet-500',
    gold: 'bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-400',
    premium: 'bg-gradient-to-tr from-orange-600 via-amber-400 to-yellow-200',
};

export const PLAN_BADGE_CLASS: Record<PlanTone, string> = {
    none: 'bg-slate-100 text-slate-600',
    plus: 'bg-gradient-to-r from-blue-600 to-violet-600 text-white',
    gold: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950',
    premium: 'bg-slate-900 text-amber-300',
};

const SIZE = {
    sm: { avatar: 'w-8 h-8', badge: 'text-[8px] px-1 -bottom-1.5' },
    md: { avatar: 'w-10 h-10', badge: 'text-[9px] px-1.5 -bottom-2' },
    lg: { avatar: 'w-20 h-20', badge: 'text-[11px] px-2 -bottom-2.5' },
};

/** ป้ายชื่อแพลนแบบเม็ดยา — ใช้ข้างชื่อผู้ใช้ในเมนู */
export function PlanBadge({ tone, label, className }: { tone: PlanTone; label: string; className?: string }) {
    if (tone === 'none') return null;
    return <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap', PLAN_BADGE_CLASS[tone], className)}>{label}</span>;
}

export function PlanAvatar({
    src,
    fallback,
    tone,
    label,
    size = 'sm',
    showBadge = true,
    className,
}: {
    src?: string | null;
    fallback: string;
    tone: PlanTone;
    /** ชื่อแพลนบนป้ายใต้รูป */
    label?: string;
    size?: keyof typeof SIZE;
    showBadge?: boolean;
    className?: string;
}) {
    const paid = tone !== 'none';
    return (
        <span className={cn('relative inline-flex shrink-0 rounded-full', paid && [size === 'lg' ? 'p-[3px]' : 'p-[2px]', RING[tone]], className)} title={paid ? label : undefined}>
            {/* ช่องขาวระหว่างวงสีกับรูป */}
            <span className={cn('inline-flex rounded-full', paid && ['bg-white', size === 'lg' ? 'p-[3px]' : 'p-[1.5px]'])}>
                <Avatar className={cn(SIZE[size].avatar, !paid && 'border border-border/50')}>
                    <AvatarImage src={src || undefined} />
                    <AvatarFallback>{fallback}</AvatarFallback>
                </Avatar>
            </span>
            {paid && showBadge && label && (
                <span
                    className={cn(
                        'absolute left-1/2 -translate-x-1/2 rounded-full border border-white font-bold leading-[1.4] whitespace-nowrap shadow-sm',
                        SIZE[size].badge,
                        PLAN_BADGE_CLASS[tone],
                    )}
                >
                    {label}
                </span>
            )}
        </span>
    );
}
