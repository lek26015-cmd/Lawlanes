'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export default function Header() {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isHomePage = pathname === '/';
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 50;
      if (scrolled !== isScrolled) {
        setIsScrolled(scrolled);
      }
    };

    if (isHomePage) {
      window.addEventListener('scroll', handleScroll);
    } else {
      // Not on home page, so header should not be transparent
      setIsScrolled(true);
    }

    return () => {
      if (isHomePage) {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isHomePage, isScrolled, pathname]);

  const useTransparentHeader = isHomePage && !isScrolled;

  if (isAuthPage) {
    return null; // Don't render header on login/signup pages
  }

  const headerClasses = cn(
    'sticky top-0 z-50 w-full border-b transition-colors duration-300',
    useTransparentHeader
      ? 'bg-white text-foreground border-gray-200'
      : 'bg-foreground text-background border-foreground'
  );

  const navLinkClasses = cn(
    'transition-colors',
    useTransparentHeader
      ? 'text-foreground/60 hover:text-foreground'
      : 'text-background/80 hover:text-background'
  );

  const activeNavLinkClasses = cn(
    'font-semibold',
    useTransparentHeader ? 'text-foreground' : 'text-background'
  );
  
  const loginButtonClasses = cn(
    useTransparentHeader ? '' : 'text-background hover:text-background hover:bg-white/10'
  );

  const signupButtonClasses = cn(
    useTransparentHeader 
      ? 'bg-foreground text-background hover:bg-foreground/90' 
      : 'bg-background text-foreground hover:bg-background/90'
  );


  return (
    <header className={headerClasses}>
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="Home">
          <Logo className={cn(useTransparentHeader ? '' : 'text-background')} />
        </Link>
        
        <div className="hidden md:flex flex-1 justify-center px-8 lg:px-16">
           {!isHomePage && (
            <div className="relative w-full max-w-lg">
              <Input
                type="search"
                placeholder="ค้นหาทนาย, ความเชี่ยวชาญ, หรือปัญหา..."
                className="w-full rounded-full bg-background/20 border-transparent focus:border-primary focus:bg-background/30 focus:ring-primary pl-4 pr-12 h-12 text-white placeholder:text-white/70"
              />
              <Button
                type="submit"
                size="icon"
                variant="secondary"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/20 hover:bg-white/30"
              >
                <Search className="h-4 w-4 text-white/80" />
              </Button>
            </div>
           )}
        </div>

        <nav className="hidden items-center gap-4 text-sm font-medium md:flex whitespace-nowrap">
          <Link href="/" className={pathname === '/' ? activeNavLinkClasses : navLinkClasses}>
            หน้าแรก
          </Link>
          <Link href="/#features" className={navLinkClasses}>
            บริการ
          </Link>
          <Link href="/articles" className={pathname.startsWith('/articles') ? activeNavLinkClasses : navLinkClasses}>
            บทความ
          </Link>
        </nav>

        <div className="hidden items-center gap-2 md:flex ml-4 whitespace-nowrap">
          <Link href="/login">
            <Button variant="ghost" className={loginButtonClasses}>เข้าสู่ระบบ</Button>
          </Link>
          <Link href="/signup">
            <Button className={signupButtonClasses}>เข้าสู่ระบบทนาย</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
