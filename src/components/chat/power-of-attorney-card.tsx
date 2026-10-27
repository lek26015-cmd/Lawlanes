'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileSignature, Loader2, Printer, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
    cancelPowerOfAttorneyAction, getChatPowerOfAttorneyAction,
    saveLawyerPowerOfAttorneyAction, submitClientPowerOfAttorneyAction,
} from '@/app/actions/power-of-attorney-actions';
import {
    EMPTY_LAWYER_INPUT, POA_CLIENT_SIDE_LABEL, POA_SPECIAL_POWERS, thaiDate,
    type PoaClientInput, type PoaClientSide, type PoaLawyerInput, type PoaSpecialPower, type PoaView,
} from '@/lib/power-of-attorney';
import { PowerOfAttorneyDocument } from '@/components/legal-docs/power-of-attorney-document';

/**
 * การ์ด "หนังสือมอบอำนาจ" ในรายละเอียดห้องคดี (PLAN-11)
 * ทนาย: สร้าง/แก้ร่าง · ลูกความ: กรอกข้อมูลตัวเอง + เลือกอำนาจพิเศษ แล้วยืนยัน · ทั้งคู่: ดูพรีวิว/พิมพ์
 */

const EMPTY_CLIENT: PoaClientInput = {
    fullName: '', age: '', nationality: 'ไทย', idType: 'thai_id', idNumber: '', address: '', phone: '', grantedPowers: [],
};

const STATUS_BADGE: Record<PoaView['status'], { label: string; className: string }> = {
    awaiting_client: { label: 'รอลูกความยืนยัน', className: 'bg-amber-100 text-amber-700' },
    ready: { label: 'พร้อมพิมพ์', className: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'ยกเลิกแล้ว', className: 'bg-slate-100 text-slate-500' },
};

export function PowerOfAttorneyCard({ chatId, compact }: { chatId: string; compact?: boolean }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<'client' | 'lawyer' | 'admin' | null>(null);
    const [poa, setPoa] = useState<PoaView | null>(null);
    const [lawyerDefaults, setLawyerDefaults] = useState<{ address: string; name: string; licenseNumber: string } | null>(null);
    const [open, setOpen] = useState<'lawyer' | 'client' | 'preview' | null>(null);

    const load = useCallback(async () => {
        const res = await getChatPowerOfAttorneyAction(chatId);
        if (res.success) {
            setRole(res.role);
            setPoa(res.poa);
            setLawyerDefaults(res.lawyerDefaults);
        }
        setLoading(false);
    }, [chatId]);

    useEffect(() => { load(); }, [load]);

    if (loading || !role || role === 'admin') return null;
    // ลูกความเห็นการ์ดเมื่อทนายส่งเอกสารมาแล้วเท่านั้น
    if (role === 'client' && !poa) return null;

    const done = () => { setOpen(null); load(); };
    const badge = poa ? STATUS_BADGE[poa.status] : null;
    const names = poa ? [poa.input.poa && 'หนังสือมอบอำนาจ', poa.input.courtAppointment && 'ใบแต่งทนายความ'].filter(Boolean).join(' + ') : '';

    return (
        <div className={compact ? 'space-y-2' : 'px-1 space-y-2'}>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">หนังสือมอบอำนาจ</p>
            {!poa ? (
                <Button variant="outline" className="w-full h-9 text-xs font-bold rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => setOpen('lawyer')}>
                    <FileSignature className="w-4 h-4 mr-2" /> สร้างหนังสือมอบอำนาจ / ใบแต่งทนาย
                </Button>
            ) : (
                <div className="w-full p-3 rounded-xl bg-gradient-to-r from-blue-50 to-white dark:from-slate-800 dark:to-slate-800 border border-blue-200 space-y-2">
                    <div className="flex justify-between items-center gap-2">
                        <span className="text-[11px] font-bold truncate">📄 {names}</span>
                        {badge && <Badge className={`text-[9px] border-none flex-shrink-0 ${badge.className}`}>{badge.label}</Badge>}
                    </div>
                    {poa.status === 'ready' && poa.clientConfirmedAt && (
                        <p className="text-[10px] text-slate-500">ลูกความยืนยันเมื่อ {thaiDate(poa.clientConfirmedAt)}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                        {role === 'client' && poa.status === 'awaiting_client' && (
                            <Button size="sm" className="h-7 text-[11px] rounded-lg bg-blue-600 hover:bg-blue-700" onClick={() => setOpen('client')}>
                                กรอกข้อมูลและยืนยัน
                            </Button>
                        )}
                        {role === 'client' && poa.status === 'ready' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg" onClick={() => setOpen('client')}>แก้ข้อมูลของฉัน</Button>
                        )}
                        {role === 'lawyer' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg" onClick={() => setOpen('lawyer')}>แก้ไข</Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg" onClick={() => setOpen('preview')}>
                            <Eye className="w-3 h-3 mr-1" /> ดูเอกสาร
                        </Button>
                        {poa.status === 'ready' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg" asChild>
                                <a href={`/power-of-attorney/${poa.id}/print`} target="_blank" rel="noopener noreferrer">
                                    <Printer className="w-3 h-3 mr-1" /> พิมพ์
                                </a>
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {open === 'lawyer' && (
                <LawyerDialog
                    chatId={chatId}
                    initial={poa?.input ?? { ...EMPTY_LAWYER_INPUT, lawyerAddress: lawyerDefaults?.address ?? '' }}
                    lawyerName={poa?.lawyer.name ?? lawyerDefaults?.name ?? ''}
                    licenseNumber={poa?.lawyer.licenseNumber ?? lawyerDefaults?.licenseNumber ?? ''}
                    wasReady={poa?.status === 'ready'}
                    canCancel={!!poa}
                    onClose={() => setOpen(null)}
                    onDone={done}
                    toast={toast}
                />
            )}
            {open === 'client' && poa && (
                <ClientDialog chatId={chatId} poa={poa} onClose={() => setOpen(null)} onDone={done} toast={toast} />
            )}
            {open === 'preview' && poa && (
                <Dialog open onOpenChange={o => !o && setOpen(null)}>
                    <DialogContent className="max-w-[900px] w-[95vw] max-h-[90vh] overflow-y-auto bg-slate-100 dark:bg-slate-900">
                        <DialogHeader>
                            <DialogTitle>{names}</DialogTitle>
                            <DialogDescription>
                                {poa.status === 'ready' ? 'พิมพ์ ลงลายมือชื่อด้วยปากกา ติดอากรแสตมป์ และแนบสำเนาบัตรของผู้มอบอำนาจ' : 'ร่าง — ลูกความยังไม่ได้กรอกข้อมูลและยืนยัน'}
                            </DialogDescription>
                        </DialogHeader>
                        <PowerOfAttorneyDocument poa={poa} />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

type ToastFn = ReturnType<typeof useToast>['toast'];

function PowerChecklist({ ids, value, onChange }: { ids: readonly PoaSpecialPower[]; value: PoaSpecialPower[]; onChange: (v: PoaSpecialPower[]) => void }) {
    return (
        <div className="space-y-2">
            {POA_SPECIAL_POWERS.filter(p => ids.includes(p.id)).map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                        checked={value.includes(p.id)}
                        onCheckedChange={c => onChange(c ? [...value, p.id] : value.filter(x => x !== p.id))}
                    />
                    {p.label}
                </label>
            ))}
        </div>
    );
}

function LawyerDialog({ chatId, initial, lawyerName, licenseNumber, wasReady, canCancel, onClose, onDone, toast }: {
    chatId: string; initial: PoaLawyerInput; lawyerName: string; licenseNumber: string; wasReady: boolean; canCancel: boolean;
    onClose: () => void; onDone: () => void; toast: ToastFn;
}) {
    const [v, setV] = useState<PoaLawyerInput>(initial);
    const [saving, setSaving] = useState(false);
    const setCourt = (patch: Partial<PoaLawyerInput['court']>) => setV(x => ({ ...x, court: { ...x.court, ...patch } }));

    const save = async () => {
        setSaving(true);
        const res = await saveLawyerPowerOfAttorneyAction(chatId, v);
        setSaving(false);
        if (!res.success) return toast({ variant: 'destructive', title: 'บันทึกไม่สำเร็จ', description: res.error });
        toast({ title: 'ส่งให้ลูกความแล้ว', description: 'ลูกความจะได้รับแจ้งให้กรอกข้อมูลและยืนยัน' });
        onDone();
    };

    const cancel = async () => {
        if (!confirm('ยกเลิกหนังสือมอบอำนาจฉบับนี้?')) return;
        setSaving(true);
        const res = await cancelPowerOfAttorneyAction(chatId);
        setSaving(false);
        if (!res.success) return toast({ variant: 'destructive', title: 'ยกเลิกไม่สำเร็จ', description: res.error });
        onDone();
    };

    return (
        <Dialog open onOpenChange={o => !o && onClose()}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>หนังสือมอบอำนาจ / ใบแต่งทนายความ</DialogTitle>
                    <DialogDescription>ลูกความจะกรอกชื่อ เลขบัตร และที่อยู่ของตัวเอง แล้วกดยืนยัน{wasReady && ' — แก้ไขแล้วลูกความต้องยืนยันใหม่'}</DialogDescription>
                </DialogHeader>

                <div className="space-y-5 text-sm">
                    <div className="space-y-2">
                        <Label>เอกสาร</Label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={v.poa} onCheckedChange={c => setV(x => ({ ...x, poa: !!c }))} /> หนังสือมอบอำนาจ (ดำเนินการนอกศาล)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={v.courtAppointment} onCheckedChange={c => setV(x => ({ ...x, courtAppointment: !!c }))} /> ใบแต่งทนายความ (คดีในศาล)
                        </label>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 space-y-1">
                        <p className="font-semibold">ผู้รับมอบอำนาจ: {lawyerName || '—'}</p>
                        <p className="text-xs text-slate-500">
                            ใบอนุญาตเลขที่ {licenseNumber || 'ยังไม่มีในโปรไฟล์ — เอกสารจะเว้นช่องไว้ให้เขียนเอง'}
                        </p>
                        <Label htmlFor="poa-addr" className="pt-2 block">ที่อยู่สำนักงาน</Label>
                        <Textarea id="poa-addr" rows={2} value={v.lawyerAddress} onChange={e => setV(x => ({ ...x, lawyerAddress: e.target.value }))} />
                    </div>

                    {v.poa && (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label htmlFor="poa-matter">เรื่องที่มอบอำนาจ</Label>
                                <Textarea
                                    id="poa-matter" rows={5} value={v.matter}
                                    placeholder="เช่น ติดต่อสถานีตำรวจ... เพื่อแจ้งความร้องทุกข์ ให้ถ้อยคำ ยื่นและรับเอกสาร และลงลายมือชื่อในเอกสารที่เกี่ยวข้องแทนข้าพเจ้าจนเสร็จการ"
                                    onChange={e => setV(x => ({ ...x, matter: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="poa-at">ทำที่</Label>
                                <Input id="poa-at" value={v.madeAt} placeholder="เช่น สำนักงานกฎหมาย... หรือ จังหวัด..." onChange={e => setV(x => ({ ...x, madeAt: e.target.value }))} />
                            </div>
                        </div>
                    )}

                    {v.courtAppointment && (
                        <div className="space-y-3 border-t pt-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="poa-court">ศาล</Label>
                                    <Input id="poa-court" value={v.court.courtName} placeholder="เช่น ศาลแพ่ง" onChange={e => setCourt({ courtName: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="poa-black">คดีหมายเลขดำที่</Label>
                                    <Input id="poa-black" value={v.court.blackCaseNo} placeholder="ว่างได้ถ้ายังไม่ยื่นฟ้อง" onChange={e => setCourt({ blackCaseNo: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="poa-kind">ความ</Label>
                                    <select id="poa-kind" className="w-full h-10 rounded-md border bg-background px-3" value={v.court.caseKind} onChange={e => setCourt({ caseKind: e.target.value as 'civil' | 'criminal' })}>
                                        <option value="civil">แพ่ง</option>
                                        <option value="criminal">อาญา</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="poa-side">ลูกความเป็น</Label>
                                    <select id="poa-side" className="w-full h-10 rounded-md border bg-background px-3" value={v.court.clientSide} onChange={e => setCourt({ clientSide: e.target.value as PoaClientSide })}>
                                        {Object.entries(POA_CLIENT_SIDE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="poa-opp">คู่ความอีกฝ่าย</Label>
                                    <Input id="poa-opp" value={v.court.opposingParty} onChange={e => setCourt({ opposingParty: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>ขออำนาจในทางจำหน่ายสิทธิ (ลูกความเป็นคนเลือกให้จริงตอนยืนยัน)</Label>
                                <PowerChecklist ids={POA_SPECIAL_POWERS.map(p => p.id)} value={v.court.requestedPowers} onChange={requestedPowers => setCourt({ requestedPowers })} />
                            </div>
                            <p className="text-xs text-slate-500">ศาลบางแห่งให้ใช้แบบพิมพ์ของศาล ตรวจสอบรูปแบบกับศาลที่จะยื่นก่อนใช้</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    {canCancel && <Button variant="ghost" className="text-red-600 mr-auto" disabled={saving} onClick={cancel}>ยกเลิกฉบับนี้</Button>}
                    <Button variant="outline" onClick={onClose} disabled={saving}>ปิด</Button>
                    <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}ส่งให้ลูกความ</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ClientDialog({ chatId, poa, onClose, onDone, toast }: {
    chatId: string; poa: PoaView; onClose: () => void; onDone: () => void; toast: ToastFn;
}) {
    const [v, setV] = useState<PoaClientInput>(poa.client ?? EMPTY_CLIENT);
    const [agree, setAgree] = useState(false);
    const [saving, setSaving] = useState(false);
    const set = (patch: Partial<PoaClientInput>) => setV(x => ({ ...x, ...patch }));
    const requested = poa.input.court.requestedPowers;

    const submit = async () => {
        setSaving(true);
        const res = await submitClientPowerOfAttorneyAction(chatId, v);
        setSaving(false);
        if (!res.success) return toast({ variant: 'destructive', title: 'ยืนยันไม่สำเร็จ', description: res.error });
        toast({ title: 'ยืนยันแล้ว', description: 'พิมพ์เอกสารเพื่อลงลายมือชื่อได้เลย' });
        onDone();
    };

    return (
        <Dialog open onOpenChange={o => !o && onClose()}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>ข้อมูลผู้มอบอำนาจ</DialogTitle>
                    <DialogDescription>กรอกตามบัตรประจำตัว ข้อมูลนี้ใช้ในเอกสารเท่านั้น และเห็นได้เฉพาะคุณกับทนายของคดีนี้</DialogDescription>
                </DialogHeader>

                {poa.input.poa && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-sm space-y-1">
                        <p className="font-semibold">มอบอำนาจให้ {poa.lawyer.name} ดำเนินการ:</p>
                        <p className="whitespace-pre-line text-slate-600 dark:text-slate-300">{poa.input.matter}</p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1 col-span-2">
                        <Label htmlFor="c-name">ชื่อ-นามสกุล (มีคำนำหน้า)</Label>
                        <Input id="c-name" value={v.fullName} onChange={e => set({ fullName: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="c-age">อายุ (ปี)</Label>
                        <Input id="c-age" inputMode="numeric" value={v.age} onChange={e => set({ age: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="c-nat">สัญชาติ</Label>
                        <Input id="c-nat" value={v.nationality} onChange={e => set({ nationality: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="c-idtype">บัตรที่ใช้</Label>
                        <select id="c-idtype" className="w-full h-10 rounded-md border bg-background px-3" value={v.idType} onChange={e => set({ idType: e.target.value as PoaClientInput['idType'] })}>
                            <option value="thai_id">บัตรประจำตัวประชาชน</option>
                            <option value="passport">หนังสือเดินทาง</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="c-id">เลขที่</Label>
                        <Input id="c-id" autoComplete="off" inputMode={v.idType === 'thai_id' ? 'numeric' : 'text'} value={v.idNumber} onChange={e => set({ idNumber: e.target.value })} />
                    </div>
                    <div className="space-y-1 col-span-2">
                        <Label htmlFor="c-addr">ที่อยู่ตามบัตร</Label>
                        <Textarea id="c-addr" rows={2} value={v.address} placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด" onChange={e => set({ address: e.target.value })} />
                    </div>
                </div>

                {poa.input.courtAppointment && requested.length > 0 && (
                    <div className="space-y-2 border-t pt-4 text-sm">
                        <Label>ทนายขออำนาจต่อไปนี้ — ติ๊กเฉพาะข้อที่คุณยินยอมให้ทนายทำแทน</Label>
                        <p className="text-xs text-slate-500">ข้อเหล่านี้กระทบสิทธิของคุณโดยตรง ข้อที่ไม่ได้ติ๊ก ทนายต้องถามคุณก่อนทุกครั้ง</p>
                        <PowerChecklist ids={requested} value={v.grantedPowers} onChange={grantedPowers => set({ grantedPowers })} />
                    </div>
                )}

                <label className="flex items-start gap-2 text-sm cursor-pointer border-t pt-4">
                    <Checkbox checked={agree} onCheckedChange={c => setAgree(!!c)} className="mt-0.5" />
                    ข้าพเจ้าตรวจข้อมูลแล้วถูกต้อง และประสงค์มอบอำนาจตามเอกสารนี้
                </label>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={saving}>ปิด</Button>
                    <Button onClick={submit} disabled={saving || !agree}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}ยืนยัน</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
