
'use client';

import Link from 'next/link';
import {
  Gavel,
  Home,
  Landmark,
  Settings,
  ShieldCheck,
  Ticket,
  Users2,
  Megaphone,
  FileText,
  ArrowLeftCircle
} from 'lucide-react';
import React, { useState, useEffect, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FirebaseContext, FirebaseContextState } from '@/firebase';
import AdminLoginPage from './login/page';
import { onAuthStateChanged } from 'firebase/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    const firebaseContext = useContext(FirebaseContext);
    const auth = firebaseContext?.auth ?? null;
    const areServicesAvailable = firebaseContext?.areServicesAvailable ?? false;

    const [isAdmin, setIsAdmin] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    useEffect(() => {
        if (!areServicesAvailable) {
            return;
        }
        if (!auth) {
            setIsCheckingAuth(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                const isSuperAdmin = user.uid === 'wS9w7ysNYUajNsBYZ6C7n2Afe9H3';
                const mockIsAdminByEmail = user.email?.includes('@lawlanes.com');
                
                if (isSuperAdmin || mockIsAdminByEmail) {
                    setIsAdmin(true);
                } else {
                    setIsAdmin(false);
                    if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
                         router.push('/');
                    }
                }
            } else {
                setIsAdmin(false);
            }
            setIsCheckingAuth(false);
        });

        return () => unsubscribe();
    }, [auth, areServicesAvailable]);

    const navItems = [
        { href: "/admin", icon: <Home className="h-4 w-4" />, label: "แดชบอร์ด" },
        { href: "/admin/customers", icon: <Users2 className="h-4 w-4" />, label: "ลูกค้า" },
        { href: "/admin/lawyers", icon: <ShieldCheck className="h-4 w-4" />, label: "ทนายความ" },
        { href: "/admin/financials", icon: <Landmark className="h-4 w-4" />, label: "การเงิน" },
        { href: "/admin/tickets", icon: <Ticket className="h-4 w-4" />, label: "Ticket ช่วยเหลือ" },
        { href: "/admin/ads", icon: <Megaphone className="h-4 w-4" />, label: "จัดการโฆษณา" },
        { href: "/admin/content", icon: <FileText className="h-4 w-4" />, label: "จัดการเนื้อหา" },
    ];
    
    const isActive = (href: string) => {
        if (href === '/admin') return pathname === href;
        return pathname.startsWith(href);
    }

    if (isCheckingAuth) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!isAdmin) {
        return <AdminLoginPage />;
    }

  return (
    <div className="grid h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
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
               {navItems.map((item) => (
                    <Link
                        key={item.label}
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
          <div className="mt-auto p-4 space-y-2">
             <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                 <Link
                    href="/admin/settings"
                    className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                        isActive("/admin/settings") && "bg-muted text-primary"
                    )}
                    >
                    <Settings className="h-4 w-4" />
                    ตั้งค่า
                </Link>
             </nav>
             <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/">
                    <ArrowLeftCircle className="mr-2 h-4 w-4" />
                    กลับไปหน้าเว็บไซต์
                </Link>
             </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-col overflow-auto bg-muted/40">
        {children}
      </div>
    </div>
  );
}
