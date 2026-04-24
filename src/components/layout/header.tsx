'use client';

import { Link, usePathname } from '@/navigation';
import { default as NextLink } from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import { Input } from '@/components/ui/input';
import { Search, Menu, User, ChevronDown, LogOut, LayoutDashboard, Camera, ShoppingCart, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useCart } from '@/context/cart-context';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useUser as useAuthUser, useFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { doc, getDoc } from 'firebase/firestore';
import profileLawyerImg from '@/pic/profile-lawyer.jpg';
import { getCloudflareVariantUrl } from '@/lib/cloudflare-images';

import { getMainLink, getBusinessLink, getAdminLink } from '@/lib/domain-utils';
import NotificationBell from './notification-bell';


export default function Header({ setUserRole, domainType = 'main' }: { setUserRole: (role: string | null) => void; domainType?: 'main' | 'lawyer' | 'admin' | 'business' }) {
  const t = useTranslations('Navigation');
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { auth, firestore } = useFirebase();
  const { user, isUserLoading: isLoading } = useAuthUser();

  const [role, setRole] = useState<string | null>(null);
  const [customClaims, setCustomClaims] = useState<{ admin?: boolean; lawyer?: boolean }>({});

  const isAdmin = role === 'admin' || customClaims.admin === true;
  const isLawyer = role === 'lawyer' || customClaims.lawyer === true;
  const isSuperUser = customClaims.admin === true;

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRole() {
      if (!user || !firestore) return;

      try {
        // 1. Read custom claims from Firebase Auth token
        const tokenResult = await user.getIdTokenResult();
        const claims = tokenResult.claims || {};
        setCustomClaims({
          admin: claims.admin === true,
          lawyer: claims.lawyer === true,
        });

        // If user has admin claim, set role immediately
        if (claims.admin === true) {
          setRole('admin');
          setUserRole('admin');
        }

        // 2. Check Lawyer Profile (Firestore)
        const lawyerDocRef = doc(firestore, "lawyerProfiles", user.uid);
        const lawyerSnap = await getDoc(lawyerDocRef);

        if (lawyerSnap.exists() || claims.lawyer === true) {
          console.log("User is a lawyer:", user.uid);
          if (!claims.admin) {
            setRole('lawyer');
            setUserRole('lawyer');
          }
          setAvatarUrl(lawyerSnap.exists() ? lawyerSnap.data().imageUrl : user.photoURL);
          if (!claims.admin) return; // Exit early if lawyer (non-admin)
        }

        // 3. Check User Profile (Firestore fallback)
        if (!claims.admin && !lawyerSnap.exists()) {
          const userDocRef = doc(firestore, "users", user.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            setRole(data.role || 'user');
            setUserRole(data.role || 'user');
            setAvatarUrl(data.avatar || user.photoURL);
          } else {
            setRole('user');
            setUserRole('user');
            setAvatarUrl(user.photoURL);
          }
        }

      } catch (error) {
        console.error("Error fetching role:", error);
      }
    }

    if (!isLoading) {
      fetchRole();
    }
  }, [user, isLoading, firestore, setUserRole]);

  // Home page detection that handles locales
  const isHomePage = (pathname === '/' || pathname === '/th' || pathname === '/en' || pathname === '/zh') && domainType === 'main';

  useEffect(() => {
    if (!isHomePage) {
      setIsScrolled(true);
      return;
    }

    const handleScroll = () => {
      // If the mobile menu is open, Radix UI might lock the scroll and report scrollY as 0.
      // We also check for pointer-events: none on body which is how Radix UI locks scroll for dropdowns.
      if (isMobileMenuOpen || (typeof document !== 'undefined' && document.body.style.pointerEvents === 'none')) {
        return;
      }
      
      const scrolled = window.scrollY > 50;
      setIsScrolled(scrolled);
    };

    // Initialize state
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isHomePage]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname])

  // Ensure stable initial render for hydration
  // We also force non-transparent if the mobile menu is open to ensure visibility
  const useTransparentHeader = isMounted && isHomePage && !isScrolled && !isMobileMenuOpen;

  const { toast } = useToast();
  const { totalItems, setIsOpen: setIsCartOpen } = useCart();

  const handleLogout = async () => {
    if (auth) {
      try {
        await fetch('/api/auth/session', { method: 'DELETE' });
      } catch (err) {
        console.error("Failed to clear session cookie:", err);
      }
      await signOut(auth);
      toast({
        title: "ออกจากระบบแล้ว!",
        description: "คุณได้ออกจากระบบเรียบร้อยแล้ว",
      });
      // Force redirect to login page after logout
      window.location.href = '/';
    }
  }

  const headerClasses = cn(
    'sticky top-0 z-[100] w-full transition-colors duration-300 transform-gpu',
    useTransparentHeader
      ? 'bg-transparent text-white border-transparent'
      : 'bg-white text-slate-900 border-slate-200 shadow-sm border-b backdrop-blur-md'
  );

  const navLinkClasses = cn(
    'transition-colors font-medium leading-none',
    useTransparentHeader
      ? 'text-white/70 hover:text-white'
      : 'text-slate-600 hover:text-[#0B3979]'
  );

  const activeNavLinkClasses = cn(
    'font-bold',
    useTransparentHeader ? 'text-white' : 'text-[#0B3979]'
  );

  const loginButtonClasses = cn(
    useTransparentHeader ? '' : 'text-slate-700 hover:text-[#0B3979] hover:bg-slate-50'
  );

  const searchInputClasses = cn(
    "w-full rounded-full border focus:ring-primary pl-4 pr-12 h-12 transition-colors",
    useTransparentHeader
      ? "bg-background/20 border-foreground/30 text-foreground placeholder:text-foreground/70 focus:bg-background/80"
      : "bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white"
  )


  return (
    <header className={headerClasses}>
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6 gap-4">
        <Logo
          href={getMainLink('/', domainType, !isMounted)}
          variant={useTransparentHeader ? "white" : "color"}
          className={cn('shrink-0', useTransparentHeader ? 'text-white' : 'text-[#0B3979]')}
          subtitle={domainType === 'business' ? "legal os" : undefined}
        />



        <div className="hidden xl:flex items-center gap-6">
          <nav className="flex items-center gap-4 text-sm font-medium whitespace-nowrap">
            <Link href={getMainLink('/lawyers', domainType)} className={pathname.startsWith(`/lawyers`) ? activeNavLinkClasses : navLinkClasses}>
              {t('findLawyer')}
            </Link>
            <Link href={getMainLink('/verify-lawyer', domainType)} className={pathname.startsWith(`/verify-lawyer`) ? activeNavLinkClasses : navLinkClasses}>
              {t('verifyLawyer')}
            </Link>

            <a href="https://capdeal.lawslane.com" target="_blank" rel="noopener noreferrer" className={pathname.startsWith(`/services/contracts/screenshot`) ? activeNavLinkClasses : navLinkClasses}>
              <span className="flex items-center gap-1"><Camera className="h-4 w-4" />{t('capAndDeal')}</span>
            </a>
            <Link href={getMainLink('/articles', domainType)} className={pathname.startsWith(`/articles`) ? activeNavLinkClasses : navLinkClasses}>
              {t('articles')}
            </Link>
            <Link href={getMainLink('/books', domainType)} className={pathname.startsWith(`/books`) ? activeNavLinkClasses : navLinkClasses}>
              {t('books')}
            </Link>
            <Link href={getMainLink('/for-lawyers', domainType)} className={pathname.startsWith(`/for-lawyers`) ? activeNavLinkClasses : navLinkClasses}>
              {t('forLawyers')}
            </Link>
            {isMounted && (
              <DropdownMenu>
                <DropdownMenuTrigger className={cn("flex items-center gap-1 font-medium focus:outline-none", navLinkClasses)}>
                  {t('forB2B')} <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 p-2">
                  <DropdownMenuLabel className="text-blue-700 font-bold bg-blue-50/50 rounded-md">{t('corporatePlans')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href={getMainLink('/coming-soon', domainType)} className="w-full flex items-center px-2 py-1.5">{t('b2bMenu.pricing')}</Link>
                  </DropdownMenuItem>

                  <div className="mt-2 mb-1">
                    <DropdownMenuLabel className="text-slate-500 font-bold bg-slate-50 rounded-md">{t('smeMenu.title')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </div>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href={getMainLink('/services/contracts', domainType)}>{t('smeMenu.contracts')}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href={getMainLink('/services/registration', domainType)}>{t('smeMenu.registration')}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href={getMainLink('/b2b#contact', domainType)}>{t('smeMenu.consultant')}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href={getMainLink('/b2b#contact', domainType)}>{t('smeMenu.dispute')}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href={getMainLink('/forms', domainType)}>{t('smeMenu.forms')}</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          <div className="hidden items-center gap-2 md:flex ml-4 whitespace-nowrap">

            {isLoading ? null : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className={cn("flex items-center gap-2", loginButtonClasses)}>
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={getCloudflareVariantUrl(avatarUrl, 'avatar') || profileLawyerImg.src} />
                      <AvatarFallback>{user.displayName?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:inline max-w-[150px] truncate">{user.displayName || user.email}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t('myAccount')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                    {isAdmin && (
                    <DropdownMenuItem asChild>
                      <a href={getAdminLink('/', domainType, !isMounted)}>
                        <LayoutDashboard className="mr-2" />{t('adminDashboard')}
                      </a>
                    </DropdownMenuItem>
                  )}

                  {(isLawyer || isSuperUser) && (
                    <DropdownMenuItem asChild>
                      <Link href="/lawyer-dashboard">
                        <LayoutDashboard className="mr-2" />{t('dashboard')} {isSuperUser ? '(ทนาย)' : ''}
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {/* Show User Dashboard to everyone as their primary 'Client' view */}
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <LayoutDashboard className="mr-2" />
                      {t('dashboard')} {(isAdmin || isLawyer) && isSuperUser ? '(ผู้ใช้)' : ''}
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href="/account"><User className="mr-2" />{t('manageAccount')}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/books/tracking"><FileText className="mr-2" />ติดตามสถานะการสั่งซื้อ</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2" />{t('logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button className={cn(
                  "rounded-full px-8 h-10 font-bold shadow-lg transition-all transform hover:scale-105 leading-none",
                  useTransparentHeader
                    ? "bg-[#0B3979] text-white border-2 border-white/20 hover:bg-[#082a5a]"
                    : "bg-[#0B3979] text-white hover:bg-[#082a5a]"
                )}>
                  {t('login')}
                </Button>
              </Link>
            )}

            <div className={cn(
              "transition-all duration-300 ease-in-out ml-2",
              useTransparentHeader ? "text-white" : "text-slate-900"
            )}>
              <LanguageSwitcher
                className={cn(
                  "h-9 px-3 text-sm flex items-center",
                  useTransparentHeader
                    ? "text-white border-white/20 bg-white/10 hover:bg-white/20"
                    : "text-slate-900 border-slate-200 bg-slate-100 hover:bg-slate-200"
                )}
                iconClassName={useTransparentHeader ? "text-white" : "text-slate-900"}
              />
            </div>

            {user && (
              <div className="ml-2">
                <NotificationBell isAdmin={isAdmin && !pathname.includes('/lawyer-dashboard') && !pathname.includes('/dashboard')} />
              </div>
            )}

            {totalItems > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className={cn("relative ml-2", loginButtonClasses)}
                onClick={() => setIsCartOpen(true)}
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 bg-gold text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white min-w-[18px]">
                  {totalItems}
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Header Icons & Menu */}
        <div className="flex items-center gap-1 xl:hidden">
          <div className={cn(
            "transition-all duration-300 ease-in-out mr-1",
            useTransparentHeader ? "text-white" : "text-slate-900"
          )}>
            <LanguageSwitcher
              className={cn(
                "h-8 px-2 text-xs flex items-center",
                useTransparentHeader
                  ? "text-white border-white/20 bg-white/10 hover:bg-white/20"
                  : "text-slate-900 border-slate-200 bg-slate-100 hover:bg-slate-200"
              )}
              iconClassName={useTransparentHeader ? "text-white" : "text-slate-900"}
            />
          </div>
          {user && (
            <div className="mr-1">
              <NotificationBell isAdmin={isAdmin && !pathname.includes('/lawyer-dashboard') && !pathname.includes('/dashboard')} />
            </div>
          )}
          {user ? (
            <Link href="/dashboard">
              <Avatar className="w-8 h-8 border border-border/50">
                <AvatarImage src={getCloudflareVariantUrl(avatarUrl, 'avatar') || profileLawyerImg.src} />
                <AvatarFallback>{user.displayName?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="icon" className={cn(useTransparentHeader ? 'text-white' : 'text-foreground')}>
                <User className="w-5 h-5" />
                <span className="sr-only">{t('login')}</span>
              </Button>
            </Link>
          )}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className={cn(useTransparentHeader ? 'text-white' : 'text-foreground')}>
                <Menu />
                <span className="sr-only">เปิดเมนู</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 flex flex-col h-full">
              <SheetHeader className="p-6 pb-0">
                <SheetTitle>
                  <Logo
                    href={getMainLink('/', domainType, !isMounted)}
                    variant="color"
                    subtitle={domainType === 'business' ? "legal os" : undefined}
                  />
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1">
                <nav className="flex flex-col gap-4 text-lg mt-6">
                  <Link href={getMainLink('/', domainType, !isMounted)} className="hover:text-primary">{t('home')}</Link>
                  <Link href={getMainLink('/lawyers', domainType)} className="hover:text-primary">{t('findLawyer')}</Link>
                  <Link href={getMainLink('/verify-lawyer', domainType)} className="hover:text-primary" onClick={() => setIsMobileMenuOpen(false)}>{t('verifyLawyer')}</Link>

                  <a href="https://capdeal.lawslane.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary"><Camera className="h-5 w-5" />{t('capAndDeal')}</a>
                  <Link href={getMainLink('/articles', domainType)} className="hover:text-primary">{t('articles')}</Link>
                  <Link href={getMainLink('/for-lawyers', domainType)} className="hover:text-primary">{t('forLawyers')}</Link>

                  <div className="flex flex-col gap-2 py-2">
                    <span className="font-semibold text-lg">{t('forB2B')}</span>

                    <span className="pl-4 text-sm font-semibold text-blue-600 mt-2">{t('corporatePlans')}</span>
                    <Link href={getMainLink('/coming-soon', domainType, !isMounted)} className="pl-6 text-base hover:text-primary text-muted-foreground" onClick={() => setIsMobileMenuOpen(false)}>{t('b2bMenu.pricing')}</Link>

                    <span className="pl-4 text-sm font-semibold text-slate-500 mt-2">{t('smeMenu.title')}</span>
                    <Link href={getMainLink('/services/contracts', domainType)} className="pl-6 text-base hover:text-primary text-muted-foreground" onClick={() => setIsMobileMenuOpen(false)}>{t('smeMenu.contracts')}</Link>
                    <Link href={getMainLink('/services/registration', domainType)} className="pl-6 text-base hover:text-primary text-muted-foreground" onClick={() => setIsMobileMenuOpen(false)}>{t('smeMenu.registration')}</Link>
                    <Link href={getMainLink('/b2b#contact', domainType)} className="pl-6 text-base hover:text-primary text-muted-foreground" onClick={() => setIsMobileMenuOpen(false)}>{t('smeMenu.consultant')}</Link>
                    <Link href={getMainLink('/b2b#contact', domainType)} className="pl-6 text-base hover:text-primary text-muted-foreground" onClick={() => setIsMobileMenuOpen(false)}>{t('smeMenu.dispute')}</Link>
                    <Link href={getMainLink('/forms', domainType)} className="pl-6 text-base hover:text-primary text-muted-foreground" onClick={() => setIsMobileMenuOpen(false)}>{t('smeMenu.forms')}</Link>
                  </div>
                </nav>
                <div className="border-t pt-6">
                  {user ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 px-2">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={getCloudflareVariantUrl(avatarUrl, 'avatar') || profileLawyerImg.src} />
                          <AvatarFallback>{user.displayName?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold">{user.displayName || user.email}</span>
                          <span className="text-xs text-muted-foreground capitalize">{role === 'lawyer' ? 'ทนายความ' : role === 'admin' ? 'ผู้ดูแลระบบ' : 'ลูกความ'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {isAdmin && (
                          <a href={getAdminLink('/', domainType, !isMounted)} className="flex items-center gap-2 p-2 hover:bg-muted rounded-md text-foreground">
                            <LayoutDashboard className="w-4 h-4" /> {t('adminDashboard')}
                          </a>
                        )}
                        {(isLawyer || isSuperUser) && (
                          <Link href="/lawyer-dashboard" className="flex items-center gap-2 p-2 hover:bg-muted rounded-md text-foreground">
                            <LayoutDashboard className="w-4 h-4" /> {t('dashboard')} {isSuperUser ? '(ทนาย)' : ''}
                          </Link>
                        )}
                        {/* Always show user dashboard for clients/personal view */}
                        <Link href="/dashboard" className="flex items-center gap-2 p-2 hover:bg-muted rounded-md">
                          <LayoutDashboard className="w-4 h-4" /> {t('dashboard')} {(isAdmin || isLawyer) ? ' (ลูกความ)' : ''}
                        </Link>
                        <Link href="/account" className="flex items-center gap-2 p-2 hover:bg-muted rounded-md">
                          <User className="w-4 h-4" /> {t('manageAccount')}
                        </Link>
                        <Link href="/books/tracking" className="flex items-center gap-2 p-2 hover:bg-muted rounded-md">
                          <FileText className="w-4 h-4" /> ติตตามสถานะการสั่งซื้อ
                        </Link>
                      </div>
                      <Button onClick={handleLogout} className="w-full mt-2" variant="destructive">{t('logout')}</Button>
                    </div>
                  ) : (
                    <Link href="/login">
                      <Button className="w-full rounded-xl bg-[#0B3979] hover:bg-[#082a5a] text-white font-semibold">{t('login')}</Button>
                    </Link>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

      </div >
    </header >
  );
}
