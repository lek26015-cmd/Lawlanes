
'use client';

import type { RegistryLawyer } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, ShieldCheck, User, Scale } from 'lucide-react';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';

interface RegistryLawyerCardProps {
  lawyer: RegistryLawyer;
}

export default function RegistryLawyerCard({ lawyer }: RegistryLawyerCardProps) {
  const t = useTranslations('Lawyers');

  const fullName = `${lawyer.prefix}${lawyer.firstName} ${lawyer.lastName}`;

  return (
    <div
      className="group relative flex flex-col md:flex-row items-center md:items-start p-6 gap-6 w-full bg-slate-50 text-card-foreground rounded-xl border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-slate-400 overflow-hidden"
    >
      {/* Decorative background blob */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-slate-200/30 rounded-full blur-2xl group-hover:bg-slate-200/50 transition-colors" />

      <div className="flex-shrink-0 flex flex-col items-center gap-3 w-full md:w-auto relative z-10">
        <div className="relative h-24 w-24 flex-shrink-0">
          <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-200 to-slate-300 ring-4 ring-slate-300 shadow-md flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <User className="w-10 h-10 text-slate-400" />
          </div>
          <div className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-sm">
            <ClipboardList className="w-5 h-5 text-slate-400" />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Scale key={i} className="w-3.5 h-3.5 text-gray-200" />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
            {t('registry.badge')}
          </p>
        </div>
      </div>

      <div className="flex-grow text-center md:text-left relative z-10 w-full">
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1 justify-center md:justify-start">
          <h3 className="font-bold text-xl text-slate-600">{fullName}</h3>
          <span className="inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-slate-100 text-slate-500 hover:bg-slate-200 gap-1">
            <ClipboardList className="w-3 h-3" />
            {t('registry.badge')}
          </span>
        </div>

        <p className="font-semibold text-slate-400 text-sm uppercase tracking-wide mb-2">
          {t('registry.licenseLabel')} {lawyer.licenseNumber}
          {lawyer.licenseType && ` · ${lawyer.licenseType}`}
        </p>
        <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
          {t('registry.notRegisteredYet')}
        </p>

        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
          <Badge variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-slate-200 font-normal">
            {t('registry.licenseLabel')} {lawyer.licenseNumber}
          </Badge>
          {lawyer.licenseType && (
            <Badge variant="outline" className="text-slate-400 font-normal border-slate-200">
              {lawyer.licenseType}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col sm:flex-row md:flex-col items-stretch justify-center gap-3 w-full md:w-40 mt-2 md:mt-0 relative z-10">
        <Link href={`/verify-lawyer?licenseNumber=${encodeURIComponent(lawyer.licenseNumber)}`}>
          <Button
            className="w-full bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white shadow-md hover:shadow-lg transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {t('registry.verifyButton')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
