import { Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';
import { Locale } from '@/../i18n.config';
import Link from 'next/link';

type LogoProps = {
  className?: string;
};

export default function Logo({ className }: LogoProps) {
  const params = useParams();
  const lang = params.lang as Locale;
  return (
    <Link href={`/${lang}`} className={cn('flex items-center gap-2 text-foreground', className)}>
      <Scale className="h-6 w-6" />
      <span className="text-xl font-bold font-headline">Lawlanes</span>
    </Link>
  );
}
