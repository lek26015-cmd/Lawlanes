import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="Home">
          <Logo className="text-primary-foreground" />
        </Link>
        
        <div className="hidden md:flex flex-1 justify-center px-8 lg:px-16">
          <div className="relative w-full max-w-lg">
            <Input
              type="search"
              placeholder="ค้นหาทนาย, ความเชี่ยวชาญ, หรือปัญหา..."
              className="w-full rounded-full bg-secondary/20 border-transparent focus:border-primary-foreground focus:bg-background/5 focus:ring-primary-foreground pl-4 pr-12 h-12"
            />
            <Button
              type="submit"
              size="icon"
              variant="secondary"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <nav className="hidden items-center gap-4 text-sm font-medium md:flex whitespace-nowrap">
          <Link href="/" className="transition-colors text-primary-foreground/80 hover:text-primary-foreground">
            หน้าแรก
          </Link>
          <Link href="#features" className="transition-colors text-primary-foreground/60 hover:text-primary-foreground">
            บริการ
          </Link>
          <Link href="#" className="transition-colors text-primary-foreground/60 hover:text-primary-foreground">
            บทความ
          </Link>
        </nav>

        <div className="hidden items-center gap-2 md:flex ml-4 whitespace-nowrap">
          <Link href="/login">
            <Button variant="ghost" className="text-primary-foreground">เข้าสู่ระบบ</Button>
          </Link>
          <Link href="/signup">
            <Button>เข้าสู่ระบบทนาย</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
