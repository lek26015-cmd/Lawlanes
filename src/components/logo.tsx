import { Scale } from 'lucide-react';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
};

export default function Logo({ className }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2 text-foreground', className)}>
      <Scale className="h-6 w-6" />
      <span className="text-xl font-bold font-headline">Lawlane</span>
    </div>
  );
}
