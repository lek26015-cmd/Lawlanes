'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Header() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  const headerClasses = cn(
    "sticky top-0 z-50 w-full border-b",
    isHomePage ? 'bg-white text-foreground' : 'bg-foreground text-background'
  );

  const navLinkClasses = cn(
    "transition-colors",
    isHomePage ? 'text-foreground/60 hover:text-foreground' : 'text-background/80 hover:text-background'
  );
  
  const activeNavLinkClasses = cn(
    "transition-colors",
    isHomePage ? 'text-foreground' : 'text-background'
  );
  
  const loginButtonClasses = cn(
    isHomePage ? '' : 'text-background hover:text-background hover:bg-white/10'
  );

  const signupButtonClasses = cn(
    isHomePage ? 'bg-foreground text-background hover:bg-foreground/90' : 'bg-background text-foreground hover:bg-background/90'
  );


  return (
    <header className={headerClasses}>
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="Home">
          <Logo className={cn(isHomePage ? '' : 'text-background')} />
        </Link>
        
        <div className="hidden md:flex flex-1 justify-center px-8 lg:px-16">
           {isHomePage && (
            <div className="relative w-full max-w-lg">
              <Input
                type="search"
                placeholder="ค้นหาทนาย, ความเชี่ยวชาญ, หรือปัญหา..."
                className="w-full rounded-full bg-gray-100 border-transparent focus:border-primary focus:bg-white focus:ring-primary pl-4 pr-12 h-12"
              />
              <Button
                type="submit"
                size="icon"
                variant="secondary"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-gray-200 hover:bg-gray-300"
              >
                <Search className="h-4 w-4 text-gray-600" />
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
          <Link href="/articles" className={pathname === '/articles' ? activeNavLinkClasses : navLinkClasses}>
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
