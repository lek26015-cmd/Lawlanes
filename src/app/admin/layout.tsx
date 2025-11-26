
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
  ArrowLeftCircle,
  LogOut,
  ChevronDown
} from 'lucide-react';
import React, { useState, useEffect, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FirebaseContext, FirebaseContextState, errorEmitter, FirestorePermissionError } from '@/firebase';
import AdminLoginPage from '../[lang]/admin/login/page';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Logo from '@/components/logo';


export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    const firebaseContext = useContext(FirebaseContext);
    const { auth, firestore, areServicesAvailable } = firebaseContext || {};

    const [isAdmin, setIsAdmin] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    const lang = pathname.split('/')[1] || 'th';
    const loginPath = `/${lang}/admin/login`;
    const adminRootPath = `/admin`; // Admin paths are not localized

    useEffect(() => {
        if (!areServicesAvailable || !auth || !firestore) {
            setIsCheckingAuth(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDocRef = doc(firestore, "users", user.uid);
                
                getDoc(userDocRef).then(userDoc => {
                     if (!userDoc.exists()) {
                        const designatedSuperAdminUID = 'wS9w7ysNYUajNsBYZ6C7n2Afe9H3';

                        if (user.uid === designatedSuperAdminUID) {
                            const newAdminData = {
                                uid: user.uid,
                                name: user.displayName || 'Admin',
                                email: user.email,
                                role: 'admin',
                                superAdmin: true,
                                registeredAt: serverTimestamp(),
                            };
                            setDoc(userDocRef, newAdminData)
                              .then(() => {
                                  // After setting the doc, we can assume the role.
                                  setIsAdmin(true);
                                  setCurrentUser(user);
                                  setUserRole('Super Admin');
                              })
                              .catch(serverError => {
                                const permissionError = new FirestorePermissionError({
                                    path: userDocRef.path,
                                    operation: 'create',
                                    requestResourceData: newAdminData,
                                });
                                errorEmitter.emit('permission-error', permissionError);
                                // Set state to non-admin because creation failed
                                setIsAdmin(false);
                              });
                        } else {
                            // Not the designated admin, sign them out.
                            setIsAdmin(false);
                            setCurrentUser(null);
                            setUserRole(null);
                            signOut(auth);
                            router.push(loginPath);
                        }
                    } else if (userDoc.exists() && userDoc.data().role === 'admin') {
                        const role = userDoc.data().superAdmin ? 'Super Admin' : 'Administrator';
                        setIsAdmin(true);
                        setCurrentUser(user);
                        setUserRole(role);
                    } else {
                        // User exists but is not an admin
                        setIsAdmin(false);
                        setCurrentUser(null);
                        setUserRole(null);
                         if (pathname.startsWith(adminRootPath) && !pathname.includes('/login')) {
                             router.push(loginPath);
                        }
                    }
                }).catch(error => {
                     const permissionError = new FirestorePermissionError({
                        path: userDocRef.path,
                        operation: 'get',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                    setIsAdmin(false);
                });
            } else {
                // No user logged in
                setIsAdmin(false);
                setCurrentUser(null);
                 setUserRole(null);
                 if (pathname.startsWith(adminRootPath) && !pathname.includes('/login')) {
                    router.push(loginPath);
                 }
            }
            setIsCheckingAuth(false);
        });

        return () => unsubscribe();
    }, [areServicesAvailable, auth, firestore, router, pathname, lang, loginPath, adminRootPath]);

    const handleLogout = async () => {
        if (auth) {
            await signOut(auth);
            router.push(loginPath);
        }
    };

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
            <Link href="/admin">
                <Logo href="/admin" />
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
          <div className="mt-auto p-4 space-y-4">
             <div className="border-t pt-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start px-2 h-auto">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={currentUser?.photoURL || ''} />
                                    <AvatarFallback>{currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-semibold">{currentUser?.displayName || currentUser?.email}</p>
                                    <p className="text-xs text-muted-foreground">{userRole}</p>
                                </div>
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">{currentUser?.displayName}</p>
                            <p className="text-xs leading-none text-muted-foreground">
                            {currentUser?.email}
                            </p>
                        </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                             <Link href="/admin/settings">
                                <Settings className="mr-2 h-4 w-4" />
                                <span>ตั้งค่า</span>
                             </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                             <Link href={`/${lang}`}>
                                <ArrowLeftCircle className="mr-2 h-4 w-4" />
                                <span>กลับไปหน้าเว็บไซต์</span>
                             </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>ออกจากระบบ</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
             </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col overflow-auto bg-muted/40">
        {React.cloneElement(children as React.ReactElement, { userRole })}
      </div>
    </div>
  );
}
