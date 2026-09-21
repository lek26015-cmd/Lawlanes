'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from '@/navigation';
import { Link } from '@/navigation';
import Image from 'next/image';
import Logo from '@/components/logo';
import logoWhite from '@/pic/logo-lawslane-transparent-white.png';
import { cn } from '@/lib/utils';
import { useUser, useFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import {
    LayoutDashboard,
    Briefcase,
    FolderLock,
    CreditCard,
    CalendarDays,
    Scale,
    FileSearch,
    ChevronLeft,
    ChevronRight,
    LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type NavItem = {
    title: string;
    icon: React.ElementType;
    href: string;
    badge?: { label: string; color: string };
};

type NavGroup = {
    title: string;
    items: NavItem[];
};

const lawyerNavGroups: NavGroup[] = [
    {
        title: 'งานหลัก (Operations)',
        items: [
            { title: 'ภาพรวม (Overview)', icon: LayoutDashboard, href: '/lawyer-dashboard' },
            { title: 'จัดการคดีและลูกความ', icon: Briefcase, href: '/lawyer-dashboard/cases', badge: { label: 'NEW', color: 'emerald' } },
            { title: 'คลังเอกสารคดี (Vault)', icon: FolderLock, href: '/lawyer-dashboard/vault' },
            { title: 'การเงินและใบกำกับภาษี', icon: CreditCard, href: '/lawyer-dashboard/financials' },
            { title: 'ปฏิทินนัดศาล/กำหนดการ', icon: CalendarDays, href: '/lawyer-schedule' },
        ],
    },
    {
        title: 'AI ทนายความ (AI Copilot)',
        items: [
            { title: 'สืบค้นข้อกฎหมาย & ฎีกา', icon: Scale, href: '/law-search' },
            { title: 'ตรวจร่างสัญญาด้วย AI', icon: FileSearch, href: '/analyze-contract', badge: { label: 'PRO', color: 'amber' } },
        ],
    },
];

export default function LawyerSidebar() {
    const pathname = usePathname();
    const { user } = useUser();
    const { auth } = useFirebase();
    const { toast } = useToast();
    const [collapsed, setCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            await fetch('/api/auth/session', { method: 'DELETE' });
            window.location.href = '/th/lawyer-login';
        } catch {
            toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถออกจากระบบได้', variant: 'destructive' });
        }
    };

    const isActive = (href: string) => {
        if (href === '/lawyer-dashboard' && (pathname === '/lawyer-dashboard' || pathname === '/lawyer-dashboard/' || pathname === '/th/lawyer-dashboard')) {
            return true;
        }
        if (href !== '/lawyer-dashboard' && pathname.includes(href)) {
            return true;
        }
        return false;
    };

    const getBadgeClasses = (color: string) => {
        const map: Record<string, string> = {
            violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
            emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
            amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
        };
        return map[color] || '';
    };

    return (
        <aside className={cn(
            "flex flex-col h-screen border-r transition-all duration-300 sticky top-0 shrink-0 select-none z-30",
            "border-[#001f35]",
            collapsed ? "w-[72px]" : "w-[270px]"
        )} style={{ backgroundColor: '#002f4b' }}>
            {/* Header / Logo */}
            <div className={cn(
                "flex items-center border-b shrink-0 px-4 py-4 relative h-20 border-white/10",
                collapsed ? "justify-center px-0" : "justify-between"
            )}>
                {!collapsed ? (
                    <div className="origin-left scale-[0.85]">
                        <Logo href="/lawyer-dashboard" variant="white" subtitle="lawyer portal" />
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10">
                        <Image src={logoWhite} alt="Lawslane" width={20} height={20} className="object-contain" />
                    </div>
                )}

                <Button
                    variant="ghost" size="icon"
                    className={cn(
                        "rounded-lg shrink-0 h-7 w-7 text-white/40 hover:text-white hover:bg-white/10",
                        collapsed && "absolute -right-3.5 top-1/2 -translate-y-1/2 bg-[#002f4b] border border-white/10 border-l-0 rounded-l-none"
                    )}
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                </Button>
            </div>

            {/* Nav Menu */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5 scrollbar-hide">
                {mounted && lawyerNavGroups.map((group, gIdx) => (
                    <div key={gIdx}>
                        {!collapsed && (
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2 px-3 text-white/80">
                                {group.title}
                            </p>
                        )}
                        {collapsed && (
                            <div className="w-6 h-px mx-auto mb-2 bg-white/10" />
                        )}

                        <div className="space-y-0.5">
                            {group.items.map((item, iIdx) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={iIdx}
                                        href={item.href}
                                        title={collapsed ? item.title : undefined}
                                        className={cn(
                                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group relative",
                                            active
                                                ? "bg-white/15 text-white shadow-sm"
                                                : "text-white/90 hover:bg-white/[0.07] hover:text-white",
                                            collapsed && "justify-center px-2"
                                        )}
                                    >
                                        {active && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-blue-400" />
                                        )}
                                        <Icon className={cn(
                                            "w-[17px] h-[17px] shrink-0",
                                            active ? "text-blue-300" : "text-white/80 group-hover:text-white"
                                        )} />
                                        {!collapsed && (
                                            <>
                                                <span className="flex-1 truncate">{item.title}</span>
                                                {item.badge && (
                                                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none shrink-0", getBadgeClasses(item.badge.color))}>
                                                        {item.badge.label}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="px-3 py-3 border-t border-white/10 flex items-center justify-between shrink-0">
                {!collapsed ? (
                    <div className="flex items-center justify-between w-full px-1">
                        <span className="text-[10px] text-white/50 font-medium">Lawslane Lawyer Portal</span>
                        <Button variant="ghost" size="icon" onClick={handleLogout} className="h-7 w-7 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg" title="ออกจากระบบ">
                            <LogOut className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                ) : (
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 mx-auto text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg" title="ออกจากระบบ">
                        <LogOut className="w-3.5 h-3.5" />
                    </Button>
                )}
            </div>
        </aside>
    );
}
