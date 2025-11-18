
'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Gavel,
  Home,
  Landmark,
  Settings,
  ShieldCheck,
  Ticket,
  Users2,
} from 'lucide-react';
import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const navItems = [
        { href: "/admin", icon: <Home className="h-4 w-4" />, label: "แดชบอร์ด" },
        { href: "/admin/customers", icon: <Users2 className="h-4 w-4" />, label: "ลูกค้า" },
        { href: "/admin/lawyers", icon: <ShieldCheck className="h-4 w-4" />, label: "ทนายความ" },
        { href: "/admin/financials", icon: <Landmark className="h-4 w-4" />, label: "การเงิน" },
        { href: "/admin/tickets", icon: <Ticket className="h-4 w-4" />, label: "Ticket ช่วยเหลือ" },
    ];
    
    const isActive = (href: string) => {
        if (href === '/admin') return pathname === href;
        return pathname.startsWith(href);
    }

  return (
    <div className="grid h-screen w-full md:grid-cols-[280px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <Gavel className="h-6 w-6" />
              <span className="">Lawlanes Admin</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-2">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                กลับไปหน้าแรก
              </Link>
               {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                         isActive(item.href) && "bg-muted text-primary"
                        )}
                    >
                        {item.icon}
                        {item.label}
                    </Link>
                ))}
            </nav>
          </div>
        </div>
      </div>
      <div className="flex flex-col overflow-auto">
        {children}
      </div>
    </div>
  );
}
