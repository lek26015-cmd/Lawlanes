import { Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type LogoProps = {
  className?: string;
  href: string;
};

export default function Logo({ className, href }: LogoProps) {
  return (
    <Link href={href} className={cn('flex items-center gap-2 text-foreground', className)}>
      <Scale className="h-6 w-6" />
      <span className="text-xl font-bold font-headline">Lawslane</span>
    </Link>
  );
}
