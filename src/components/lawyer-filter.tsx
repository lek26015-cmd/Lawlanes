
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
import { thaiProvinces } from '@/data/thai-provinces';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Scale } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function LawyerFilterSidebar() {
  const t = useTranslations('Lawyers');
  const router = useRouter();
  const pathname = usePathname();

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
    <Card className="rounded-3xl shadow-lg border-2 border-slate-100 overflow-hidden bg-white">
      <CardHeader className="bg-slate-50/50 pb-4">
        <CardTitle className="text-xl text-[#0B3979] font-headline">{t('filter.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-3">
          <Label htmlFor="specialty" className="text-sm font-semibold text-slate-700">{t('filter.expertise')}</Label>
          <Select value={specialty} onValueChange={setSpecialty}>
            <SelectTrigger id="specialty" className="rounded-full border-slate-200 bg-white shadow-sm hover:border-[#0B3979]/50 transition-colors h-11">
              <SelectValue placeholder={t('filter.all')} />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
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

        <div className="space-y-3">
          <Label htmlFor="province" className="text-sm font-semibold text-slate-700">{t('filter.province')}</Label>
          <Select value={province} onValueChange={setProvince}>
            <SelectTrigger id="province" className="rounded-full border-slate-200 bg-white shadow-sm hover:border-[#0B3979]/50 transition-colors h-11">
              <SelectValue placeholder={t('filter.allProvinces')} />
            </SelectTrigger>
            <SelectContent className="rounded-2xl max-h-[300px]">
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
      </CardContent>
      <CardFooter className="pb-8 pt-4">
        <Button 
          onClick={handleSearch}
          className="w-full rounded-full h-12 text-base font-bold shadow-lg hover:shadow-xl transition-all duration-300 bg-[#0B3979] hover:bg-[#082a5a] text-white"
        >
          {t('filter.searchButton')}
        </Button>
      </CardFooter>
    </Card>
  );
}

