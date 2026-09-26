'use client';

/**
 * ฟิลด์โปรไฟล์ล่ามที่ใช้ร่วมกันระหว่างใบสมัคร (/for-interpreters) และแท็บโปรไฟล์ในแดชบอร์ดล่าม
 * ตรวจค่าจริงฝั่ง server (interpreter-profile-actions.ts) — ตรงนี้แค่ช่วยกรอก
 */

import { Plus, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { THAI_PROVINCES } from '@/lib/thai-provinces';
import {
    INTERPRETER_LANGUAGE_CODES,
    INTERPRETER_LANGUAGE_LEVELS,
    INTERPRETER_SERVICES,
    RATE_LIMITS,
    RATE_UNITS,
    type InterpreterLanguage,
    type InterpreterLanguageCode,
    type InterpreterLanguageLevel,
    type InterpreterService,
    type RateItem,
    type RateUnit,
} from '@/lib/interpreter-types';
import { useInterpreterLabels } from './use-interpreter-labels';

const PROVINCES = THAI_PROVINCES.flatMap(r => r.provinces).sort((a, b) => a.localeCompare(b, 'th'));

export type InterpreterProfileValues = {
    description: string;
    languages: InterpreterLanguage[];
    services: InterpreterService[];
    serviceProvinces: string[];
    remoteAvailable: boolean;
    rateCard: RateItem[];
};

const newItem = (unit: RateUnit, name: string, price: number, extra: Partial<RateItem> = {}): RateItem => ({
    id: '', name, description: '', unit, price, minQty: 1, sessionHours: unit === 'session' ? 4 : 0, services: [], ...extra,
});

export const EMPTY_PROFILE_VALUES: InterpreterProfileValues = {
    description: '',
    languages: [{ code: 'th', level: 'native' }, { code: 'en', level: 'fluent' }],
    services: [],
    serviceProvinces: [],
    remoteAvailable: false,
    rateCard: [],
};

/** เรทการ์ดตัวอย่างตั้งต้นของใบสมัคร — ชื่อตามภาษาของหน้า ล่ามแก้/ลบได้ทั้งหมด */
export function defaultRateCard(names: { hour: string; day: string }): RateItem[] {
    return [newItem('hour', names.hour, 1500, { minQty: 2 }), newItem('day', names.day, 9000)];
}

export function InterpreterProfileFields({ value, onChange, gpPercent }: {
    value: InterpreterProfileValues;
    onChange: (v: InterpreterProfileValues) => void;
    gpPercent: number;
}) {
    const t = useTranslations('ForInterpreters');
    const l = useInterpreterLabels();
    const set = <K extends keyof InterpreterProfileValues>(k: K, v: InterpreterProfileValues[K]) => onChange({ ...value, [k]: v });
    const setItem = (i: number, patch: Partial<RateItem>) =>
        set('rateCard', value.rateCard.map((x, j) => (j === i ? { ...x, ...patch } : x)));

    const unusedLanguages = INTERPRETER_LANGUAGE_CODES.filter(c => !value.languages.some(x => x.code === c));
    const net = (price: number) => Math.floor(price * (100 - gpPercent)) / 100;

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="description">{t('description')}</Label>
                <Textarea
                    id="description"
                    rows={5}
                    maxLength={3000}
                    placeholder={t('descriptionPlaceholder')}
                    value={value.description}
                    onChange={e => set('description', e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label>{t('languagesLabel')}</Label>
                <div className="space-y-2">
                    {value.languages.map((lang, i) => (
                        <div key={lang.code} className="flex items-center gap-2">
                            <span className="w-28 text-sm font-medium">{l.language(lang.code)}</span>
                            <Select
                                value={lang.level}
                                onValueChange={v => set('languages', value.languages.map((x, j) => j === i ? { ...x, level: v as InterpreterLanguageLevel } : x))}
                            >
                                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {INTERPRETER_LANGUAGE_LEVELS.map(lv => <SelectItem key={lv} value={lv}>{l.level(lv)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="remove"
                                onClick={() => set('languages', value.languages.filter((_, j) => j !== i))}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
                {unusedLanguages.length > 0 && (
                    <Select
                        value=""
                        onValueChange={v => set('languages', [...value.languages, { code: v as InterpreterLanguageCode, level: 'fluent' }])}
                    >
                        <SelectTrigger className="w-56"><SelectValue placeholder={`+ ${t('addLanguage')}`} /></SelectTrigger>
                        <SelectContent>
                            {unusedLanguages.map(c => <SelectItem key={c} value={c}>{l.language(c)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
            </div>

            <div className="space-y-2">
                <Label>{t('servicesLabel')}</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                    {INTERPRETER_SERVICES.map(s => (
                        <label key={s} className="flex items-center gap-2 text-sm rounded-lg border p-3 cursor-pointer hover:bg-slate-50">
                            <Checkbox
                                checked={value.services.includes(s)}
                                onCheckedChange={c => set('services', c ? [...value.services, s] : value.services.filter(x => x !== s))}
                            />
                            {l.service(s)}
                        </label>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <Label>{t('provincesLabel')}</Label>
                <Select value="" onValueChange={v => !value.serviceProvinces.includes(v) && set('serviceProvinces', [...value.serviceProvinces, v])}>
                    <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="+" /></SelectTrigger>
                    <SelectContent>
                        {PROVINCES.filter(p => !value.serviceProvinces.includes(p)).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2">
                    {value.serviceProvinces.map(p => (
                        <Badge key={p} variant="secondary" className="gap-1">
                            {p}
                            <button type="button" aria-label="remove" onClick={() => set('serviceProvinces', value.serviceProvinces.filter(x => x !== p))}>
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
                <label className="flex items-center gap-2 text-sm pt-2">
                    <Switch checked={value.remoteAvailable} onCheckedChange={v => set('remoteAvailable', v)} />
                    {t('remoteLabel')}
                </label>
            </div>

            <div className="space-y-3">
                <div>
                    <Label>{t('rateCardLabel')}</Label>
                    <p className="text-xs text-muted-foreground mt-1">{t('rateCardHint')}</p>
                </div>
                {value.rateCard.map((item, i) => (
                    <div key={i} className="rounded-xl border p-4 space-y-3">
                        <div className="grid sm:grid-cols-[1fr_11rem_9rem_auto] gap-3 items-end">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">{t('rateName')}</Label>
                                <Input value={item.name} maxLength={RATE_LIMITS.name} placeholder={t('rateNamePlaceholder')}
                                    onChange={e => setItem(i, { name: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">{t('rateUnit')}</Label>
                                <Select value={item.unit} onValueChange={v => setItem(i, {
                                    unit: v as RateUnit,
                                    sessionHours: v === 'session' ? item.sessionHours || 4 : 0,
                                    minQty: v === 'hour' || v === 'page' ? item.minQty : 1,
                                })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {RATE_UNITS.map(u => <SelectItem key={u} value={u}>{l.unit(u)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">{t('ratePrice')}</Label>
                                <Input type="number" min={RATE_LIMITS.price.min} max={RATE_LIMITS.price.max} value={item.price}
                                    onChange={e => setItem(i, { price: Number(e.target.value) || 0 })} />
                            </div>
                            <Button type="button" variant="ghost" size="icon" aria-label="remove" disabled={value.rateCard.length <= 1}
                                onClick={() => set('rateCard', value.rateCard.filter((_, j) => j !== i))}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                            {(item.unit === 'hour' || item.unit === 'page') && (
                                <div className="space-y-1 w-36">
                                    <Label className="text-xs text-muted-foreground">{item.unit === 'hour' ? t('rateMinHours') : t('rateMinPages')}</Label>
                                    <Input type="number" min={1} max={RATE_LIMITS.minQty.max} value={item.minQty}
                                        onChange={e => setItem(i, { minQty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
                                </div>
                            )}
                            {item.unit === 'session' && (
                                <div className="space-y-1 w-36">
                                    <Label className="text-xs text-muted-foreground">{t('rateSessionHours')}</Label>
                                    <Input type="number" min={RATE_LIMITS.sessionHours.min} max={RATE_LIMITS.sessionHours.max} value={item.sessionHours}
                                        onChange={e => setItem(i, { sessionHours: Math.floor(Number(e.target.value) || 0) })} />
                                </div>
                            )}
                            <p className="text-xs text-emerald-700 pb-2">{t('youReceiveItem', { net: l.money(net(item.price)), percent: gpPercent })}</p>
                        </div>
                        <Textarea rows={2} maxLength={RATE_LIMITS.description} value={item.description} placeholder={t('rateDescriptionPlaceholder')}
                            onChange={e => setItem(i, { description: e.target.value })} />
                    </div>
                ))}
                {value.rateCard.length < RATE_LIMITS.maxItems && (
                    <Button type="button" variant="outline" size="sm"
                        onClick={() => set('rateCard', [...value.rateCard, newItem('case', '', 0)])}>
                        <Plus className="w-4 h-4 mr-2" /> {t('addRate')}
                    </Button>
                )}
            </div>
        </div>
    );
}
