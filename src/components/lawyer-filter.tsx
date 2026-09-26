
'use client';

import { useState } from 'react';
import { useRouter, usePathname } from '@/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { thaiProvinces } from '@/lib/thai-provinces';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Languages, Scale, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { useInterpreterLabels } from '@/components/interpreter/use-interpreter-labels';
import { INTERPRETER_LANGUAGE_CODES, INTERPRETER_SERVICES } from '@/lib/interpreter-types';
import { cn } from '@/lib/utils';

type SearchTarget = 'lawyer' | 'interpreter';

export default function LawyerFilterSidebar() {
  const t = useTranslations('Lawyers');
  const tVerify = useTranslations('VerifyLawyer');
  const tInterp = useTranslations('Interpreters');
  const l = useInterpreterLabels();
  const router = useRouter();
  const pathname = usePathname();

  const [target, setTarget] = useState<SearchTarget>('lawyer');
  // จังหวัดใช้ร่วมกันทั้งสองโหมด — สลับไปมาแล้วค่าไม่หาย
  const [language, setLanguage] = useState<string>('all');
  const [service, setService] = useState<string>('all');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [specialty, setSpecialty] = useState<string>('all');
  const [minRating, setMinRating] = useState<string>('all');
  const [province, setProvince] = useState<string>('all');

  // Specialty keys to map to translations
  const specialtyKeys = [
    'smeFraud',
    'civilCommercial',
    'contractBreach',
    'realEstate',
    'familyInheritance',
    'criminal',
    'labor',
    'intellectualProperty',
    'business'
  ] as const;

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (target === 'interpreter') {
      // พารามิเตอร์ตรงกับที่ /interpreters อ่าน (lang, service, province, remote)
      if (language !== 'all') params.set('lang', language);
      if (service !== 'all') params.set('service', service);
      if (province !== 'all') params.set('province', province);
      if (remoteOnly) params.set('remote', '1');
      const qs = params.toString();
      router.push(`/interpreters${qs ? `?${qs}` : ''}`);
      return;
    }
    if (specialty !== 'all') params.set('specialties', specialty);
    if (minRating !== 'all') params.set('rating', minRating);
    if (province !== 'all') params.set('province', province);

    const queryString = params.toString();
    const targetUrl = `/lawyers${queryString ? `?${queryString}` : ''}`;

    // If already on search page, just replace URL (or let page handle it)
    // If not, redirect
    router.push(targetUrl);
  };

  return (
    <Card className="rounded-xl shadow-lg border-2 border-slate-100 overflow-hidden bg-white">
      <CardHeader className="bg-slate-50/50 pb-4">
        <CardTitle className="text-xl text-[#0B3979] font-headline">{t('filter.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-slate-700">{t('filter.searchFor')}</Label>
          <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {([
              { value: 'lawyer', label: t('filter.targetLawyer'), icon: Scale },
              { value: 'interpreter', label: t('filter.targetInterpreter'), icon: Languages },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={target === value}
                onClick={() => setTarget(value)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg h-9 text-sm font-semibold transition-colors',
                  target === value ? 'bg-white text-[#0B3979] shadow-sm' : 'text-slate-500 hover:text-[#0B3979]'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {target === 'interpreter' ? (
          <>
            <div className="space-y-3">
              <Label htmlFor="interp-language" className="text-sm font-semibold text-slate-700">{tInterp('filterLanguage')}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="interp-language" className="rounded-xl border-slate-200 bg-white shadow-sm hover:border-[#0B3979]/50 transition-colors h-11">
                  <SelectValue placeholder={tInterp('all')} />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-[300px]">
                  <SelectItem value="all" className="rounded-lg">{tInterp('all')}</SelectItem>
                  {INTERPRETER_LANGUAGE_CODES.map(code => (
                    <SelectItem key={code} value={code} className="rounded-lg">{l.language(code)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="interp-service" className="text-sm font-semibold text-slate-700">{tInterp('filterService')}</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger id="interp-service" className="rounded-xl border-slate-200 bg-white shadow-sm hover:border-[#0B3979]/50 transition-colors h-11">
                  <SelectValue placeholder={tInterp('all')} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="rounded-lg">{tInterp('all')}</SelectItem>
                  {INTERPRETER_SERVICES.map(s => (
                    <SelectItem key={s} value={s} className="rounded-lg">{l.service(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
        <>
        <div className="space-y-3">
          <Label htmlFor="specialty" className="text-sm font-semibold text-slate-700">{t('filter.expertise')}</Label>
          <Select value={specialty} onValueChange={setSpecialty}>
            <SelectTrigger id="specialty" className="rounded-xl border-slate-200 bg-white shadow-sm hover:border-[#0B3979]/50 transition-colors h-11">
              <SelectValue placeholder={t('filter.all')} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg">{t('filter.all')}</SelectItem>
              {specialtyKeys.map((key) => (
                <SelectItem key={key} value={key} className="rounded-lg">
                  {t(`specialties.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-slate-700">{t('filter.minRating')}</Label>
          <RadioGroup value={minRating} onValueChange={setMinRating} className="space-y-2.5">
            {[4, 3, 2].map((rating) => (
              <div key={rating} className="flex items-center space-x-3 group cursor-pointer">
                <RadioGroupItem value={String(rating)} id={`rating-${rating}`} className="border-slate-300 text-[#0B3979]" />
                <Label htmlFor={`rating-${rating}`} className="flex items-center gap-1 font-medium text-slate-600 cursor-pointer group-hover:text-[#0B3979] transition-colors">
                  {[...Array(5)].map((_, i) => (
                    <Scale key={i} className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1 font-normal">{t('filter.andUp')}</span>
                </Label>
              </div>
            ))}
            <div className="flex items-center space-x-3 group cursor-pointer">
              <RadioGroupItem value="all" id="rating-all" className="border-slate-300 text-[#0B3979]" />
              <Label htmlFor="rating-all" className="font-medium text-slate-600 cursor-pointer group-hover:text-[#0B3979] transition-colors">{t('filter.all')}</Label>
            </div>
          </RadioGroup>
        </div>
        </>
        )}

        <div className="space-y-3">
          <Label htmlFor="province" className="text-sm font-semibold text-slate-700">{t('filter.province')}</Label>
          <Select value={province} onValueChange={setProvince}>
            <SelectTrigger id="province" className="rounded-xl border-slate-200 bg-white shadow-sm hover:border-[#0B3979]/50 transition-colors h-11">
              <SelectValue placeholder={t('filter.allProvinces')} />
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-[300px]">
              <SelectItem value="all" className="rounded-lg">{t('filter.allProvinces')}</SelectItem>
              {thaiProvinces.map((region) => (
                <SelectGroup key={region.region}>
                  <SelectLabel className="px-2 py-1.5 text-xs font-bold text-[#0B3979] uppercase tracking-wider bg-slate-50 mt-2 mb-1">{region.region}</SelectLabel>
                  {region.provinces.map((prov) => (
                    <SelectItem key={prov} value={prov} className="rounded-lg">
                      {prov}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        {target === 'interpreter' && (
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="interp-remote" className="text-sm font-semibold text-slate-700">{tInterp('filterRemote')}</Label>
            <Switch id="interp-remote" checked={remoteOnly} onCheckedChange={setRemoteOnly} />
          </div>
        )}
      </CardContent>
      <CardFooter className="pb-8 pt-4 flex flex-col gap-3">
        <Button 
          onClick={handleSearch}
          className="w-full rounded-xl h-12 text-base font-bold shadow-lg hover:shadow-xl transition-all duration-300 bg-[#0B3979] hover:bg-[#082a5a] text-white"
        >
          {target === 'interpreter' ? t('filter.searchInterpreterButton') : t('filter.searchButton')}
        </Button>
        {target === 'lawyer' && (
        <Link
          href="/verify-lawyer"
          className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-[#0B3979] transition-colors py-2 rounded-xl hover:bg-blue-50"
        >
          <ShieldCheck className="w-4 h-4" />
          {tVerify('filter.verifyLink')}
        </Link>
        )}
      </CardFooter>
    </Card>
  );
}

