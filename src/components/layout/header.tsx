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
          <Logo />
        </Link>
        
        <div className="hidden md:flex flex-1 justify-center px-8 lg:px-16">
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
        </div>

        <nav className="hidden items-center gap-4 text-sm font-medium md:flex whitespace-nowrap">
          <Link href="/" className="transition-colors text-foreground/80 hover:text-foreground">
            หน้าแรก
          </Link>
          <Link href="#features" className="transition-colors text-foreground/60 hover:text-foreground">
            บริการ
          </Link>
          <Link href="#" className="transition-colors text-foreground/60 hover:text-foreground">
            บทความ
          </Link>
        </nav>

        <div className="hidden items-center gap-2 md:flex ml-4 whitespace-nowrap">
          <Link href="/login">
            <Button variant="ghost">เข้าสู่ระบบ</Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-foreground text-background hover:bg-foreground/90">เข้าสู่ระบบทนาย</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
