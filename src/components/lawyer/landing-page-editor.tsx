'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/navigation';
import { Crown, ExternalLink, ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
    EMPTY_LANDING,
    LANDING_LIMITS,
    LANDING_THEME_COLORS,
    findProhibitedClaim,
    normalizeSlug,
    slugError,
    type LawyerLandingInput,
} from '@/lib/landing-page';

type SlugState = { checking: boolean; message: string | null; ok: boolean };

function Counter({ value, max }: { value: string; max: number }) {
    return <span className="text-xs text-muted-foreground">{value.length}/{max}</span>;
}

export default function LandingPageEditor() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [form, setForm] = useState<LawyerLandingInput>(EMPTY_LANDING);
    const [savedStatus, setSavedStatus] = useState<'published' | 'draft' | null>(null);
    const [savedSlug, setSavedSlug] = useState('');
    const [tier, setTier] = useState<PlanTier>('free');
    const [suspended, setSuspended] = useState(false);
    const [lawyer, setLawyer] = useState<PublicLawyer | null>(null);
    const [slugState, setSlugState] = useState<SlugState>({ checking: false, message: null, ok: false });
    const fileRef = useRef<HTMLInputElement>(null);

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
                setSavedStatus(res.page.status);
                setSavedSlug(res.page.slug);
                setSlugState({ checking: false, message: null, ok: true });
            } else if (res.lawyer) {
                // ตั้งต้นจากข้อมูลสาธารณะเท่านั้น — ไม่เติมเบอร์/อีเมล/ที่อยู่จากโปรไฟล์ให้เอง
                setForm(f => ({ ...f, title: res.lawyer!.name, sections: { ...f.sections, about: { enabled: true, text: res.lawyer!.description || '' } } }));
            }
            setLoading(false);
        })();
    }, [toast]);

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
        const s = form.sections;
        const texts = [form.title, form.tagline, s.about.text, ...s.services.items.flatMap(i => [i.title, i.description]), ...s.faq.items.flatMap(i => [i.question, i.answer])];
        for (const t of texts) { const hit = findProhibitedClaim(t); if (hit) return hit; }
        return null;
    }, [form]);

    const set = <K extends keyof LawyerLandingInput>(key: K, value: LawyerLandingInput[K]) => setForm(f => ({ ...f, [key]: value }));
    const setSection = <K extends keyof LawyerLandingInput['sections']>(key: K, patch: Partial<LawyerLandingInput['sections'][K]>) =>
        setForm(f => ({ ...f, sections: { ...f.sections, [key]: { ...f.sections[key], ...patch } } }));
    const setContact = (key: keyof LawyerLandingInput['contactInfo'], value: string) =>
        setForm(f => ({ ...f, contactInfo: { ...f.contactInfo, [key]: value } }));

    const handleUpload = async (file: File) => {
        if (file.size > LANDING_LIMITS.imageBytes) {
            toast({ title: 'ไฟล์ใหญ่เกินไป', description: 'รูปต้องไม่เกิน 5MB', variant: 'destructive' });
            return;
        }
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        const res = await uploadLandingImageAction(fd);
        setUploading(false);
        if (res.success) set('heroImage', res.url);
        else toast({ title: 'อัปโหลดไม่สำเร็จ', description: res.error, variant: 'destructive' });
    };

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
    const canPublish = paid && approved && !suspended && slugState.ok && !claimWarning;

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
            {suspended && (
                <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800">หน้านี้ถูกระงับโดยผู้ดูแลระบบ กรุณาติดต่อฝ่ายสนับสนุน</div>
            )}
            {!approved && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700">เผยแพร่ได้หลังบัญชีทนายได้รับการอนุมัติ</div>
            )}

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
                        <Button variant="outline" disabled={saving} onClick={() => save('draft')}>ปิดการเผยแพร่</Button>
                    ) : (
                        <Button variant="outline" disabled={saving || !slugState.ok} onClick={() => save('draft')}>บันทึกแบบร่าง</Button>
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

            <div className="grid gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
                <div className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">ลิงก์และหน้าตา</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="slug">ชื่อลิงก์</Label>
                                <div className="flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
                                    <span className="pl-3 text-sm text-muted-foreground whitespace-nowrap">lawslane.com/p/</span>
                                    <Input id="slug" value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase())} className="border-0 focus-visible:ring-0 pl-0.5" placeholder="somchai-law" maxLength={LANDING_LIMITS.slugMax} />
                                </div>
                                <p className="text-xs text-muted-foreground">ใช้ a-z, 0-9 และขีด (-) · เปลี่ยนภายหลังได้ แต่ลิงก์เดิมที่แชร์ไว้จะใช้ไม่ได้</p>
                                {slugState.checking ? (
                                    <p className="text-xs text-muted-foreground">กำลังตรวจ...</p>
                                ) : slugState.message && (
                                    <p className={`text-xs ${slugState.ok ? 'text-emerald-600' : 'text-red-600'}`}>{slugState.message}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label>แม่แบบ</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {([['classic', 'คลาสสิก', 'รูปปกด้านบน จัดกลาง'], ['modern', 'โมเดิร์น', 'แถบสีเต็ม รูปด้านข้าง']] as const).map(([id, name, desc]) => (
                                        <button key={id} type="button" onClick={() => set('template', id)} className={`text-left p-3 rounded-lg border transition-colors ${form.template === id ? 'border-[#002f4b] bg-[#002f4b]/5 dark:border-blue-400' : 'hover:bg-muted'}`}>
                                            <div className="font-medium text-sm">{name}</div>
                                            <div className="text-xs text-muted-foreground">{desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>สีธีม</Label>
                                <div className="flex gap-2">
                                    {LANDING_THEME_COLORS.map(c => (
                                        <button key={c} type="button" aria-label={c} onClick={() => set('themeColor', c)} className={`w-8 h-8 rounded-full ring-offset-2 ring-offset-background ${form.themeColor === c ? 'ring-2 ring-slate-900 dark:ring-white' : ''}`} style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>รูปปก (ไม่บังคับ)</Label>
                                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
                                <div className="flex items-center gap-2">
                                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                                        {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" />}
                                        {form.heroImage ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                                    </Button>
                                    {form.heroImage && (
                                        <Button type="button" variant="ghost" size="sm" onClick={() => set('heroImage', '')}><X className="w-4 h-4 mr-1" /> เอาออก</Button>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">JPG/PNG/WebP ไม่เกิน 5MB · รูปโปรไฟล์ใช้รูปจากบัญชีทนายของคุณ</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">ส่วนหัว</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between"><Label htmlFor="title">ชื่อที่แสดง</Label><Counter value={form.title} max={LANDING_LIMITS.title} /></div>
                                <Input id="title" value={form.title} maxLength={LANDING_LIMITS.title} onChange={e => set('title', e.target.value)} placeholder="ทนายสมชาย ใจดี / สำนักงานกฎหมาย..." />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between"><Label htmlFor="tagline">คำอธิบายสั้น</Label><Counter value={form.tagline} max={LANDING_LIMITS.tagline} /></div>
                                <Input id="tagline" value={form.tagline} maxLength={LANDING_LIMITS.tagline} onChange={e => set('tagline', e.target.value)} placeholder="ให้คำปรึกษาคดีแพ่งและครอบครัว ในเขตกรุงเทพฯ" />
                            </div>
                            <p className="text-xs text-muted-foreground">ชื่อทนาย เลขใบอนุญาต สถานะยืนยันตัวตน และคะแนนรีวิว ดึงจากบัญชีของคุณโดยอัตโนมัติ แก้ในหน้านี้ไม่ได้</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">ส่วนของหน้า</CardTitle></CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between"><Label>เกี่ยวกับ</Label><Switch checked={form.sections.about.enabled} onCheckedChange={v => setSection('about', { enabled: v })} /></div>
                                {form.sections.about.enabled && (
                                    <>
                                        <Textarea rows={6} value={form.sections.about.text} maxLength={LANDING_LIMITS.about} onChange={e => setSection('about', { text: e.target.value })} placeholder="ประสบการณ์ แนวทางการทำงาน พื้นที่ให้บริการ..." />
                                        <div className="text-right"><Counter value={form.sections.about.text} max={LANDING_LIMITS.about} /></div>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <div><Label>ความเชี่ยวชาญ</Label><p className="text-xs text-muted-foreground">จากโปรไฟล์: {lawyer?.specialty.join(', ') || '—'}</p></div>
                                <Switch checked={form.sections.specialties.enabled} onCheckedChange={v => setSection('specialties', { enabled: v })} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div><Label>รีวิวจากลูกความ</Label><p className="text-xs text-muted-foreground">แสดงเมื่อมีรีวิวแล้ว</p></div>
                                <Switch checked={form.sections.reviews.enabled} onCheckedChange={v => setSection('reviews', { enabled: v })} />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between"><Label>บริการ (สูงสุด {LANDING_LIMITS.services})</Label><Switch checked={form.sections.services.enabled} onCheckedChange={v => setSection('services', { enabled: v })} /></div>
                                {form.sections.services.enabled && (
                                    <div className="space-y-3">
                                        {form.sections.services.items.map((it, i) => (
                                            <div key={i} className="p-3 rounded-lg border space-y-2">
                                                <div className="flex gap-2">
                                                    <Input value={it.title} maxLength={LANDING_LIMITS.serviceTitle} placeholder="ชื่อบริการ" onChange={e => setSection('services', { items: form.sections.services.items.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} />
                                                    <Button type="button" variant="ghost" size="icon" aria-label="ลบ" onClick={() => setSection('services', { items: form.sections.services.items.filter((_, j) => j !== i) })}><Trash2 className="w-4 h-4" /></Button>
                                                </div>
                                                <Textarea rows={2} value={it.description} maxLength={LANDING_LIMITS.serviceDescription} placeholder="รายละเอียด (ไม่บังคับ)" onChange={e => setSection('services', { items: form.sections.services.items.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} />
                                            </div>
                                        ))}
                                        {form.sections.services.items.length < LANDING_LIMITS.services && (
                                            <Button type="button" variant="outline" size="sm" onClick={() => setSection('services', { items: [...form.sections.services.items, { title: '', description: '' }] })}><Plus className="w-4 h-4 mr-1" /> เพิ่มบริการ</Button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between"><Label>คำถามที่พบบ่อย (สูงสุด {LANDING_LIMITS.faq})</Label><Switch checked={form.sections.faq.enabled} onCheckedChange={v => setSection('faq', { enabled: v })} /></div>
                                {form.sections.faq.enabled && (
                                    <div className="space-y-3">
                                        {form.sections.faq.items.map((it, i) => (
                                            <div key={i} className="p-3 rounded-lg border space-y-2">
                                                <div className="flex gap-2">
                                                    <Input value={it.question} maxLength={LANDING_LIMITS.faqQuestion} placeholder="คำถาม" onChange={e => setSection('faq', { items: form.sections.faq.items.map((x, j) => j === i ? { ...x, question: e.target.value } : x) })} />
                                                    <Button type="button" variant="ghost" size="icon" aria-label="ลบ" onClick={() => setSection('faq', { items: form.sections.faq.items.filter((_, j) => j !== i) })}><Trash2 className="w-4 h-4" /></Button>
                                                </div>
                                                <Textarea rows={3} value={it.answer} maxLength={LANDING_LIMITS.faqAnswer} placeholder="คำตอบ" onChange={e => setSection('faq', { items: form.sections.faq.items.map((x, j) => j === i ? { ...x, answer: e.target.value } : x) })} />
                                            </div>
                                        ))}
                                        {form.sections.faq.items.length < LANDING_LIMITS.faq && (
                                            <Button type="button" variant="outline" size="sm" onClick={() => setSection('faq', { items: [...form.sections.faq.items, { question: '', answer: '' }] })}><Plus className="w-4 h-4 mr-1" /> เพิ่มคำถาม</Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">ช่องทางติดต่อ</CardTitle>
                            <p className="text-xs text-muted-foreground">ข้อมูลในส่วนนี้จะเปิดให้ทุกคนเห็น กรอกเฉพาะช่องทางที่คุณต้องการเผยแพร่ · ปุ่ม &quot;แชทกับทนาย&quot; และ &quot;นัดปรึกษา&quot; ผ่าน Lawslane แสดงเสมอ</p>
                        </CardHeader>
                        <CardContent className="grid gap-3">
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
                                    <Input id={`c-${key}`} value={form.contactInfo[key] || ''} placeholder={ph} maxLength={LANDING_LIMITS.contactField} onChange={e => setContact(key, e.target.value)} />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                <div className="xl:sticky xl:top-4 self-start">
                    <div className="text-xs text-muted-foreground mb-2">ตัวอย่าง</div>
                    <div className="rounded-xl border overflow-hidden shadow-sm max-h-[80vh] overflow-y-auto bg-white">
                        {lawyer ? (
                            <div className="pointer-events-none select-none">
                                <LandingPageView data={{ kind: 'lawyer', page: { ...form, title: form.title || lawyer.name }, lawyer }} locale="th" />
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
