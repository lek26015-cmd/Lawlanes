'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/navigation';
import { ChevronDown, ChevronUp, Crown, ExternalLink, ImagePlus, Loader2, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import LandingPageView from '@/components/landing/landing-page-view';
import {
    checkLandingSlugAction,
    getMyLandingPageAction,
    saveMyLandingPageAction,
    uploadLandingImageAction,
} from '@/app/actions/lawyer-landing-actions';
import type { PublicLawyer } from '@/app/actions/lawyer-directory-actions';
import type { PlanTier } from '@/lib/provider-plans';
import {
    DEFAULT_SECTION_TITLES,
    EMPTY_LANDING,
    LANDING_LIMITS as LIM,
    LANDING_THEME_COLORS,
    LANGUAGE_OPTIONS,
    colorError,
    findProhibitedClaim,
    landingTexts,
    normalizeSlug,
    slugError,
    type LandingFont,
    type LandingTemplate,
    type LawyerLandingInput,
    type SectionKey,
} from '@/lib/landing-page';

type SlugState = { checking: boolean; message: string | null; ok: boolean };
type Sections = LawyerLandingInput['sections'];

const TEMPLATES: [LandingTemplate, string, string][] = [
    ['classic', 'คลาสสิก', 'รูปปกด้านบน จัดกลาง'],
    ['modern', 'โมเดิร์น', 'แถบสีเต็ม รูปด้านข้าง'],
    ['minimal', 'มินิมอล', 'พื้นขาว เรียบ อ่านง่าย'],
    ['elegant', 'หรูหรา', 'ส่วนหัวโทนเข้ม จัดกลาง'],
];

const FONTS: [LandingFont, string, string][] = [
    ['prompt', 'Prompt', 'ทันสมัย (ค่าเริ่มต้น)'],
    ['serif', 'Noto Serif Thai', 'มีหัว เป็นทางการ'],
    ['sarabun', 'Sarabun', 'เรียบ แบบเอกสาร'],
];

/** ส่วนที่ดึงข้อมูลจากบัญชีทนาย — แก้เนื้อหาในหน้านี้ไม่ได้ */
const PROFILE_SOURCED: Partial<Record<SectionKey, string>> = {
    experience: 'ดึงจากประวัติการศึกษาและประสบการณ์ในบัญชีทนาย',
    specialties: 'ดึงจากความเชี่ยวชาญในบัญชีทนาย',
    reviews: 'แสดงเมื่อมีรีวิวจากลูกความแล้ว',
    hours: 'ดึงจากตารางนัดหมาย (วันและเวลาทำการ)',
};

function Counter({ value, max }: { value: string; max: number }) {
    return <span className="text-xs text-muted-foreground">{value.length}/{max}</span>;
}

/** ปุ่มอัปโหลดรูปขึ้น Cloudflare Images + แสดงรูปย่อ */
function ImageField({ value, onChange, label, hint, round }: { value: string; onChange: (url: string) => void; label?: string; hint?: string; round?: boolean }) {
    const { toast } = useToast();
    const ref = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const upload = async (file: File) => {
        if (file.size > LIM.imageBytes) { toast({ title: 'ไฟล์ใหญ่เกินไป', description: 'รูปต้องไม่เกิน 5MB', variant: 'destructive' }); return; }
        setBusy(true);
        const fd = new FormData();
        fd.append('file', file);
        const res = await uploadLandingImageAction(fd);
        setBusy(false);
        if (res.success) onChange(res.url);
        else toast({ title: 'อัปโหลดไม่สำเร็จ', description: res.error, variant: 'destructive' });
    };
    return (
        <div className="space-y-1.5">
            {label && <Label>{label}</Label>}
            <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
            <div className="flex items-center gap-3">
                {value && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={value} alt="" className={`w-12 h-12 object-cover border ${round ? 'rounded-full' : 'rounded-md'}`} />
                )}
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" />}
                    {value ? 'เปลี่ยน' : 'อัปโหลด'}
                </Button>
                {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}><X className="w-4 h-4 mr-1" /> เอาออก</Button>}
            </div>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

/** แก้รายการ (บริการ / FAQ / ทีม / ข้อความอิสระ) แบบเพิ่ม-ลบ-แก้ */
function ItemList<T>({ items, max, onChange, blank, addLabel, render }: {
    items: T[]; max: number; onChange: (items: T[]) => void; blank: T; addLabel: string;
    render: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode;
}) {
    return (
        <div className="space-y-3">
            {items.map((it, i) => (
                <div key={i} className="p-3 rounded-lg border space-y-2 relative">
                    <Button type="button" variant="ghost" size="icon" aria-label="ลบ" className="absolute top-1.5 right-1.5 h-8 w-8" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="pr-9 space-y-2">{render(it, patch => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}</div>
                </div>
            ))}
            {items.length < max && (
                <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, { ...blank }])}><Plus className="w-4 h-4 mr-1" /> {addLabel}</Button>
            )}
        </div>
    );
}

export default function LandingPageEditor() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<LawyerLandingInput>(EMPTY_LANDING);
    const [savedStatus, setSavedStatus] = useState<'published' | 'draft' | null>(null);
    const [savedSlug, setSavedSlug] = useState('');
    const [tier, setTier] = useState<PlanTier>('free');
    const [suspended, setSuspended] = useState(false);
    const [lawyer, setLawyer] = useState<PublicLawyer | null>(null);
    const [slugState, setSlugState] = useState<SlugState>({ checking: false, message: null, ok: false });
    const [openSection, setOpenSection] = useState<SectionKey | null>('about');
    const [colorInput, setColorInput] = useState<string>(EMPTY_LANDING.themeColor);

    const paid = tier !== 'free';
    const approved = lawyer?.status === 'approved';

    useEffect(() => {
        (async () => {
            const res = await getMyLandingPageAction();
            if (!res.success) {
                setLoadError(res.error.startsWith('Forbidden') ? 'หน้านี้ใช้ได้เฉพาะบัญชีทนาย' : 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
                setLoading(false);
                return;
            }
            setTier(res.tier);
            setSuspended(res.suspended);
            setLawyer(res.lawyer);
            if (res.page) {
                setForm(res.page);
                setColorInput(res.page.themeColor);
                setSavedStatus(res.page.status);
                setSavedSlug(res.page.slug);
                setSlugState({ checking: false, message: null, ok: true });
            } else if (res.lawyer) {
                // ตั้งต้นจากข้อมูลสาธารณะเท่านั้น — ไม่เติมเบอร์/อีเมล/ที่อยู่จากโปรไฟล์ให้เอง
                setForm(f => ({ ...f, title: res.lawyer!.name, sections: { ...f.sections, about: { enabled: true, text: res.lawyer!.description || '' } } }));
            }
            setLoading(false);
        })();
    }, []);

    // ตรวจชื่อลิงก์แบบหน่วงเวลา
    useEffect(() => {
        const slug = normalizeSlug(form.slug);
        if (!slug) { setSlugState({ checking: false, message: null, ok: false }); return; }
        const localErr = slugError(slug);
        if (localErr) { setSlugState({ checking: false, message: localErr, ok: false }); return; }
        if (slug === savedSlug) { setSlugState({ checking: false, message: null, ok: true }); return; }
        setSlugState(s => ({ ...s, checking: true }));
        const timer = setTimeout(async () => {
            const res = await checkLandingSlugAction(slug);
            if (!res.success) setSlugState({ checking: false, message: res.error, ok: false });
            else setSlugState({ checking: false, message: res.available ? 'ใช้ชื่อนี้ได้' : res.reason || 'ใช้ไม่ได้', ok: res.available });
        }, 500);
        return () => clearTimeout(timer);
    }, [form.slug, savedSlug]);

    const claimWarning = useMemo(() => {
        for (const t of landingTexts(form)) { const hit = findProhibitedClaim(t); if (hit) return hit; }
        return null;
    }, [form]);
    const themeColorError = colorError(form.themeColor);

    const set = <K extends keyof LawyerLandingInput>(key: K, value: LawyerLandingInput[K]) => setForm(f => ({ ...f, [key]: value }));
    const setSection = <K extends keyof Sections>(key: K, patch: Partial<Sections[K]>) =>
        setForm(f => ({ ...f, sections: { ...f.sections, [key]: { ...f.sections[key], ...patch } } }));
    const setContact = (key: keyof LawyerLandingInput['contactInfo'], value: string) =>
        setForm(f => ({ ...f, contactInfo: { ...f.contactInfo, [key]: value } }));
    const setTitle = (k: SectionKey, v: string) => setForm(f => ({ ...f, sectionTitles: { ...f.sectionTitles, [k]: v } }));
    const move = (k: SectionKey, dir: -1 | 1) => setForm(f => {
        const order = [...f.sectionOrder];
        const i = order.indexOf(k);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= order.length) return f;
        [order[i], order[j]] = [order[j], order[i]];
        return { ...f, sectionOrder: order };
    });
    const applyColor = (hex: string) => { setColorInput(hex); if (/^#[0-9a-f]{6}$/i.test(hex)) set('themeColor', hex.toLowerCase()); };

    const save = async (status: 'published' | 'draft') => {
        setSaving(true);
        const res = await saveMyLandingPageAction({ ...form, status });
        setSaving(false);
        if (!res.success) {
            toast({ title: 'บันทึกไม่สำเร็จ', description: res.error, variant: 'destructive' });
            return;
        }
        setForm(f => ({ ...f, slug: res.slug, status: res.status }));
        setSavedSlug(res.slug);
        setSavedStatus(res.status);
        toast({ title: res.status === 'published' ? 'เผยแพร่หน้าเว็บแล้ว' : 'บันทึกแบบร่างแล้ว' });
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
    }
    if (loadError) {
        return <div className="p-10 text-center text-sm text-muted-foreground border rounded-xl">{loadError}</div>;
    }

    const publicPath = savedSlug ? `/p/${savedSlug}` : null;
    const canSave = slugState.ok && !claimWarning && !themeColorError;
    const canPublish = paid && approved && !suspended && canSave;
    const s = form.sections;

    /** ฟอร์มเนื้อหาของส่วนที่ทนายพิมพ์เอง */
    const sectionEditor = (k: SectionKey): React.ReactNode => {
        switch (k) {
            case 'about':
                return (
                    <>
                        <Textarea rows={6} value={s.about.text} maxLength={LIM.about} onChange={e => setSection('about', { text: e.target.value })} placeholder="ประสบการณ์ แนวทางการทำงาน พื้นที่ให้บริการ... (เว้นว่าง = ใช้คำอธิบายจากบัญชีทนาย)" />
                        <div className="text-right"><Counter value={s.about.text} max={LIM.about} /></div>
                    </>
                );
            case 'services':
                return (
                    <ItemList items={s.services.items} max={LIM.services} blank={{ title: '', description: '' }} addLabel="เพิ่มบริการ"
                        onChange={items => setSection('services', { items })}
                        render={(it, upd) => (<>
                            <Input value={it.title} maxLength={LIM.serviceTitle} placeholder="ชื่อบริการ" onChange={e => upd({ title: e.target.value })} />
                            <Textarea rows={2} value={it.description} maxLength={LIM.serviceDescription} placeholder="รายละเอียด (ไม่บังคับ)" onChange={e => upd({ description: e.target.value })} />
                        </>)} />
                );
            case 'team':
                return (
                    <ItemList items={s.team.items} max={LIM.team} blank={{ name: '', role: '', photo: '' }} addLabel="เพิ่มสมาชิก"
                        onChange={items => setSection('team', { items })}
                        render={(it, upd) => (<>
                            <div className="grid grid-cols-2 gap-2">
                                <Input value={it.name} maxLength={LIM.teamName} placeholder="ชื่อ" onChange={e => upd({ name: e.target.value })} />
                                <Input value={it.role} maxLength={LIM.teamRole} placeholder="ตำแหน่ง" onChange={e => upd({ role: e.target.value })} />
                            </div>
                            <ImageField value={it.photo} onChange={photo => upd({ photo })} round />
                        </>)} />
                );
            case 'gallery':
                return (
                    <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                            {s.gallery.images.map((src, i) => (
                                <div key={i} className="relative aspect-[4/3] rounded-md overflow-hidden border">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={src} alt="" className="w-full h-full object-cover" />
                                    <button type="button" aria-label="ลบรูป" onClick={() => setSection('gallery', { images: s.gallery.images.filter((_, j) => j !== i) })}
                                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                                </div>
                            ))}
                        </div>
                        {s.gallery.images.length < LIM.gallery && (
                            <ImageField value="" onChange={url => url && setSection('gallery', { images: [...s.gallery.images, url] })}
                                hint={`รูปสำนักงาน/บรรยากาศ สูงสุด ${LIM.gallery} รูป — ห้ามใช้รูปเอกสารหรือข้อมูลของลูกความ`} />
                        )}
                    </div>
                );
            case 'faq':
                return (
                    <ItemList items={s.faq.items} max={LIM.faq} blank={{ question: '', answer: '' }} addLabel="เพิ่มคำถาม"
                        onChange={items => setSection('faq', { items })}
                        render={(it, upd) => (<>
                            <Input value={it.question} maxLength={LIM.faqQuestion} placeholder="คำถาม" onChange={e => upd({ question: e.target.value })} />
                            <Textarea rows={3} value={it.answer} maxLength={LIM.faqAnswer} placeholder="คำตอบ" onChange={e => upd({ answer: e.target.value })} />
                        </>)} />
                );
            case 'languages':
                return (
                    <div className="flex flex-wrap gap-2">
                        {LANGUAGE_OPTIONS.map(l => {
                            const on = s.languages.items.includes(l);
                            return (
                                <button key={l} type="button" onClick={() => setSection('languages', { items: on ? s.languages.items.filter(x => x !== l) : [...s.languages.items, l] })}
                                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${on ? 'bg-[#002f4b] text-white border-[#002f4b]' : 'hover:bg-muted'}`}>{l}</button>
                            );
                        })}
                    </div>
                );
            case 'location':
                return (
                    <div className="space-y-1">
                        <Input value={s.location.mapQuery} maxLength={LIM.mapQuery} placeholder={form.contactInfo.address || 'ชื่อสำนักงานหรือที่อยู่สำหรับค้นใน Google Maps'} onChange={e => setSection('location', { mapQuery: e.target.value })} />
                        <p className="text-xs text-muted-foreground">เว้นว่าง = ใช้ที่อยู่จากแท็บติดต่อ · แสดงเป็นปุ่ม &quot;เปิดใน Google Maps&quot; (ไม่ฝังแผนที่ เพื่อไม่ส่งข้อมูลผู้เข้าชมให้ Google)</p>
                    </div>
                );
            case 'custom':
                return (
                    <ItemList items={s.custom.items} max={LIM.custom} blank={{ title: '', body: '' }} addLabel="เพิ่มหัวข้อ"
                        onChange={items => setSection('custom', { items })}
                        render={(it, upd) => (<>
                            <Input value={it.title} maxLength={LIM.customTitle} placeholder="หัวข้อ" onChange={e => upd({ title: e.target.value })} />
                            <Textarea rows={4} value={it.body} maxLength={LIM.customBody} placeholder="เนื้อหา" onChange={e => upd({ body: e.target.value })} />
                        </>)} />
                );
            case 'contact':
                return <p className="text-xs text-muted-foreground">แก้ช่องทางติดต่อในแท็บ &quot;ติดต่อ&quot; · ปุ่มแชทและนัดปรึกษาผ่าน Lawslane แสดงเสมอ</p>;
            default:
                return PROFILE_SOURCED[k] ? <p className="text-xs text-muted-foreground">{PROFILE_SOURCED[k]}</p> : null;
        }
    };

    return (
        <div className="space-y-6">
            {!paid && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30">
                    <div className="flex items-start gap-3">
                        <Crown className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-900 dark:text-amber-200">
                            หน้าเว็บส่วนตัวเป็นสิทธิ์ของแพลน <b>Pro</b> และ <b>บริษัท</b> — ตอนนี้ลองจัดหน้าและบันทึกแบบร่างได้ เผยแพร่ได้หลังอัปเกรด
                        </p>
                    </div>
                    <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-white shrink-0">
                        <Link href="/lawyer-dashboard/plan">ดูแพลน</Link>
                    </Button>
                </div>
            )}
            {suspended && <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800">หน้านี้ถูกระงับโดยผู้ดูแลระบบ กรุณาติดต่อฝ่ายสนับสนุน</div>}
            {!approved && <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700">เผยแพร่ได้หลังบัญชีทนายได้รับการอนุมัติ</div>}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                    สถานะ: {savedStatus === 'published' ? <span className="text-emerald-600 font-medium">เผยแพร่แล้ว</span> : savedStatus === 'draft' ? 'แบบร่าง' : 'ยังไม่ได้บันทึก'}
                    {publicPath && savedStatus === 'published' && (
                        <a href={`/th${publicPath}`} target="_blank" rel="noopener noreferrer" className="ml-3 inline-flex items-center gap-1 text-[#002f4b] dark:text-blue-300 hover:underline">
                            lawslane.com{publicPath} <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    )}
                </div>
                <div className="flex gap-2">
                    {savedStatus === 'published' ? (
                        <Button variant="outline" disabled={saving || !canSave} onClick={() => save('draft')}>ปิดการเผยแพร่</Button>
                    ) : (
                        <Button variant="outline" disabled={saving || !canSave} onClick={() => save('draft')}>บันทึกแบบร่าง</Button>
                    )}
                    <Button disabled={saving || !canPublish} onClick={() => save('published')} className="bg-[#002f4b] hover:bg-[#003d61] text-white">
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {savedStatus === 'published' ? 'บันทึกและอัปเดตหน้า' : 'เผยแพร่'}
                    </Button>
                </div>
            </div>

            {claimWarning && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
                    ข้อความ “{claimWarning}” เข้าข่ายรับประกันผลหรืออวดอ้างเกินจริง ซึ่งขัดมรรยาททนายความ กรุณาแก้ก่อนบันทึก
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
                <Tabs defaultValue="look" className="space-y-4">
                    <TabsList className="grid grid-cols-3 w-full">
                        <TabsTrigger value="look">หน้าตา</TabsTrigger>
                        <TabsTrigger value="sections">ส่วนของหน้า</TabsTrigger>
                        <TabsTrigger value="contact">ติดต่อ</TabsTrigger>
                    </TabsList>

                    <TabsContent value="look" className="space-y-4 mt-0">
                        <Card><CardContent className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="slug">ชื่อลิงก์</Label>
                                <div className="flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
                                    <span className="pl-3 text-sm text-muted-foreground whitespace-nowrap">lawslane.com/p/</span>
                                    <Input id="slug" value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase())} className="border-0 focus-visible:ring-0 pl-0.5" placeholder="somchai-law" maxLength={LIM.slugMax} />
                                </div>
                                <p className="text-xs text-muted-foreground">ใช้ a-z, 0-9 และขีด (-) · เปลี่ยนภายหลังได้ แต่ลิงก์เดิมที่แชร์ไว้จะใช้ไม่ได้</p>
                                {slugState.checking ? <p className="text-xs text-muted-foreground">กำลังตรวจ...</p>
                                    : slugState.message && <p className={`text-xs ${slugState.ok ? 'text-emerald-600' : 'text-red-600'}`}>{slugState.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between"><Label htmlFor="title">ชื่อที่แสดง</Label><Counter value={form.title} max={LIM.title} /></div>
                                <Input id="title" value={form.title} maxLength={LIM.title} onChange={e => set('title', e.target.value)} placeholder="ทนายสมชาย ใจดี / สำนักงานกฎหมาย..." />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between"><Label htmlFor="tagline">คำอธิบายสั้น</Label><Counter value={form.tagline} max={LIM.tagline} /></div>
                                <Input id="tagline" value={form.tagline} maxLength={LIM.tagline} onChange={e => set('tagline', e.target.value)} placeholder="ให้คำปรึกษาคดีแพ่งและครอบครัว ในเขตกรุงเทพฯ" />
                            </div>
                            <p className="text-xs text-muted-foreground">ชื่อทนาย เลขใบอนุญาต สถานะยืนยันตัวตน และคะแนนรีวิว ดึงจากบัญชีของคุณโดยอัตโนมัติ แก้ในหน้านี้ไม่ได้</p>
                        </CardContent></Card>

                        <Card><CardContent className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <Label>แม่แบบ</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {TEMPLATES.map(([id, name, desc]) => (
                                        <button key={id} type="button" onClick={() => set('template', id)} className={`text-left p-3 rounded-lg border transition-colors ${form.template === id ? 'border-[#002f4b] bg-[#002f4b]/5 dark:border-blue-400' : 'hover:bg-muted'}`}>
                                            <div className="font-medium text-sm">{name}</div>
                                            <div className="text-xs text-muted-foreground">{desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>ฟอนต์หัวข้อ</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {FONTS.map(([id, name, desc]) => (
                                        <button key={id} type="button" onClick={() => set('headingFont', id)} className={`text-left p-2.5 rounded-lg border transition-colors ${form.headingFont === id ? 'border-[#002f4b] bg-[#002f4b]/5 dark:border-blue-400' : 'hover:bg-muted'}`}>
                                            <div className="font-medium text-xs">{name}</div>
                                            <div className="text-[11px] text-muted-foreground leading-tight">{desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>สีธีม</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                    {LANDING_THEME_COLORS.map(c => (
                                        <button key={c} type="button" aria-label={c} onClick={() => applyColor(c)} className={`w-8 h-8 rounded-full ring-offset-2 ring-offset-background ${form.themeColor === c ? 'ring-2 ring-slate-900 dark:ring-white' : ''}`} style={{ backgroundColor: c }} />
                                    ))}
                                    <label className="relative w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden" title="เลือกสีเอง">
                                        <Plus className="w-4 h-4 text-muted-foreground" />
                                        <input type="color" value={form.themeColor} onChange={e => applyColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    </label>
                                    <Input value={colorInput} onChange={e => applyColor(e.target.value.trim())} className="w-28 h-8 font-mono text-xs" maxLength={7} aria-label="รหัสสี" />
                                </div>
                                {themeColorError && <p className="text-xs text-red-600">{themeColorError}</p>}
                            </div>
                        </CardContent></Card>

                        <Card><CardContent className="p-5 space-y-4">
                            <ImageField label="รูปปก (ไม่บังคับ)" value={form.heroImage} onChange={v => set('heroImage', v)} hint="JPG/PNG/WebP ไม่เกิน 5MB" />
                            {form.heroImage && (
                                <div className="space-y-1.5">
                                    <div className="flex justify-between"><Label>ความเข้มชั้นทับรูปปก</Label><span className="text-xs text-muted-foreground">{form.heroOverlay}%</span></div>
                                    <input type="range" min={0} max={70} step={10} value={form.heroOverlay} onChange={e => set('heroOverlay', Number(e.target.value))} className="w-full accent-[#002f4b]" />
                                    <p className="text-xs text-muted-foreground">เพิ่มความเข้มถ้าตัวอักษรบนรูปอ่านยาก</p>
                                </div>
                            )}
                            <ImageField label="โลโก้สำนักงาน (ไม่บังคับ)" value={form.logo} onChange={v => set('logo', v)} hint="แนะนำ PNG พื้นใส" />
                            <ImageField label="รูปโปรไฟล์ในหน้านี้ (ไม่บังคับ)" value={form.profileImage} onChange={v => set('profileImage', v)} round hint="เว้นว่าง = ใช้รูปจากบัญชีทนาย" />
                        </CardContent></Card>
                    </TabsContent>

                    <TabsContent value="sections" className="space-y-2 mt-0">
                        <p className="text-xs text-muted-foreground px-1">กดลูกศรเพื่อจัดลำดับ · เปิด/ปิดแต่ละส่วน · กดชื่อส่วนเพื่อแก้หัวข้อและเนื้อหา</p>
                        {form.sectionOrder.map((k, idx) => {
                            const open = openSection === k;
                            const enabled = s[k].enabled;
                            const customTitle = form.sectionTitles[k];
                            return (
                                <Card key={k} className={enabled ? '' : 'opacity-60'}>
                                    <div className="flex items-center gap-1 p-2 pl-3">
                                        <div className="flex flex-col">
                                            <button type="button" aria-label="เลื่อนขึ้น" disabled={idx === 0} onClick={() => move(k, -1)} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                                            <button type="button" aria-label="เลื่อนลง" disabled={idx === form.sectionOrder.length - 1} onClick={() => move(k, 1)} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                                        </div>
                                        <button type="button" onClick={() => setOpenSection(open ? null : k)} className="flex-1 text-left px-2 py-1.5 min-w-0">
                                            <div className="font-medium text-sm truncate">{customTitle || DEFAULT_SECTION_TITLES[k]}</div>
                                            {customTitle && <div className="text-[11px] text-muted-foreground">{DEFAULT_SECTION_TITLES[k]}</div>}
                                        </button>
                                        {k === 'contact'
                                            ? <span className="text-[11px] text-muted-foreground pr-2">แสดงเสมอ</span>
                                            : <Switch checked={enabled} onCheckedChange={v => setSection(k, { enabled: v } as any)} aria-label={`แสดง${DEFAULT_SECTION_TITLES[k]}`} />}
                                    </div>
                                    {open && (
                                        <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t">
                                            <div className="space-y-1 pt-3">
                                                <Label className="text-xs">ชื่อหัวข้อ</Label>
                                                <div className="flex gap-2">
                                                    <Input value={customTitle ?? ''} placeholder={DEFAULT_SECTION_TITLES[k]} maxLength={LIM.sectionTitle} onChange={e => setTitle(k, e.target.value)} />
                                                    {customTitle && <Button type="button" variant="ghost" size="icon" aria-label="ใช้ชื่อเดิม" onClick={() => setTitle(k, '')}><RotateCcw className="w-4 h-4" /></Button>}
                                                </div>
                                            </div>
                                            {sectionEditor(k)}
                                        </CardContent>
                                    )}
                                </Card>
                            );
                        })}
                    </TabsContent>

                    <TabsContent value="contact" className="mt-0">
                        <Card><CardContent className="p-5 space-y-3">
                            <p className="text-xs text-muted-foreground">ข้อมูลในส่วนนี้จะเปิดให้ทุกคนเห็น กรอกเฉพาะช่องทางที่คุณต้องการเผยแพร่ · ปุ่ม &quot;แชทกับทนาย&quot; และ &quot;นัดปรึกษา&quot; ผ่าน Lawslane แสดงเสมอ</p>
                            {([
                                ['phone', 'เบอร์โทร', '02-xxx-xxxx'],
                                ['email', 'อีเมล', 'office@example.com'],
                                ['lineId', 'LINE ID', '@yourfirm'],
                                ['facebook', 'Facebook', 'https://facebook.com/...'],
                                ['website', 'เว็บไซต์', 'https://...'],
                                ['address', 'ที่อยู่สำนักงาน', ''],
                            ] as const).map(([key, label, ph]) => (
                                <div key={key} className="space-y-1">
                                    <Label htmlFor={`c-${key}`} className="text-xs">{label}</Label>
                                    <Input id={`c-${key}`} value={form.contactInfo[key] || ''} placeholder={ph} maxLength={LIM.contactField} onChange={e => setContact(key, e.target.value)} />
                                </div>
                            ))}
                        </CardContent></Card>
                    </TabsContent>
                </Tabs>

                <div className="xl:sticky xl:top-4 self-start">
                    <div className="text-xs text-muted-foreground mb-2">ตัวอย่าง</div>
                    <div className="rounded-xl border overflow-hidden shadow-sm max-h-[80vh] overflow-y-auto bg-white">
                        {lawyer ? (
                            <div className="pointer-events-none select-none">
                                <LandingPageView data={{ kind: 'lawyer', page: { ...form, title: form.title || lawyer.name, themeColor: themeColorError ? EMPTY_LANDING.themeColor : form.themeColor }, lawyer }} locale="th" />
                            </div>
                        ) : (
                            <div className="p-10 text-center text-sm text-muted-foreground">ไม่พบข้อมูลโปรไฟล์ทนาย</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
