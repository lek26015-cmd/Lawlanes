'use client';

import LawyerPageHeader from '@/components/lawyer/lawyer-page-header';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Briefcase,
    Plus,
    Search,
    Calendar,
    User,
    Scale,
    Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { Case, CaseStatus } from '@/lib/types/billing-types';
import { getLawyerLegalCases, createLegalCaseAction, updateCaseStatusAction } from '@/app/actions/lawyer-case-actions';

type CaseCategory = 'แพ่ง/พาณิชย์' | 'อาญา' | 'แรงงาน' | 'ทรัพย์สินทางปัญญา' | 'มรดก/ครอบครัว' | 'สัญญาธุรกิจ' | 'อื่นๆ';

// ข้อมูลส่วนที่ schema ของ legalCases ไม่มี field ตรงๆ ให้ (ชื่อลูกความ/ศาล/ค่าจ้าง) ถูกเก็บไว้ใน
// `metadata` (JSON string) ตามที่ type `Case.metadata` ออกแบบไว้ให้ใช้แทนการเพิ่ม field ใหม่ในระบบที่ใช้ร่วมกัน
type CaseMetadata = {
    clientName?: string;
    category?: CaseCategory | string;
    court?: string;
    fee?: number;
    paid?: number;
};

function parseMetadata(metadata?: string): CaseMetadata {
    if (!metadata) return {};
    try {
        return JSON.parse(metadata);
    } catch {
        return {};
    }
}

const STATUS_LABEL: Record<CaseStatus, { label: string; className: string }> = {
    pending: { label: '1. รอดำเนินการ', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    drafting: { label: '2. กำลังดำเนินการ', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    'in-court': { label: '3. อยู่ระหว่างพิจารณา', className: 'bg-purple-50 text-purple-700 border-purple-200' },
    closed: { label: '4. ปิดคดีแล้ว', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

export default function LawyerCasesPage() {
    const { toast } = useToast();
    const [cases, setCases] = useState<Case[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStage, setSelectedStage] = useState('all');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [newTitle, setNewTitle] = useState('');
    const [newClient, setNewClient] = useState('');
    const [newCategory, setNewCategory] = useState<CaseCategory>('แพ่ง/พาณิชย์');
    const [newFee, setNewFee] = useState('');
    const [newCourt, setNewCourt] = useState('');

    const fetchCases = async () => {
        setIsLoading(true);
        try {
            const data = await getLawyerLegalCases();
            setCases(data);
        } catch (error) {
            toast({ title: 'โหลดข้อมูลคดีไม่สำเร็จ', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredCases = cases.filter(c => {
        const meta = parseMetadata(c.metadata);
        const matchSearch =
            c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (meta.clientName || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchStage = selectedStage === 'all' || c.status === selectedStage;
        return matchSearch && matchStage;
    });

    const handleCreateCase = async () => {
        if (!newTitle.trim() || !newClient.trim()) {
            toast({ title: 'กรุณากรอกข้อมูล', description: 'ระบุชื่อคดีและชื่อลูกความให้ครบถ้วน', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await createLegalCaseAction({
                title: newTitle,
                clientName: newClient,
                category: newCategory,
                court: newCourt,
                fee: Number(newFee) || 0,
            });

            if (result.success) {
                setIsAddOpen(false);
                setNewTitle('');
                setNewClient('');
                setNewFee('');
                setNewCourt('');
                toast({ title: 'เปิดคดีใหม่สำเร็จ', description: `บันทึกคดี "${newTitle}" เรียบร้อยแล้ว` });
                fetchCases();
            } else {
                toast({ title: 'ไม่สามารถเปิดคดีได้', description: result.error, variant: 'destructive' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusChange = async (caseId: string, newStatus: CaseStatus) => {
        const previous = cases;
        setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: newStatus } : c));

        const result = await updateCaseStatusAction(caseId, newStatus);
        if (!result.success) {
            setCases(previous);
            toast({ title: 'ไม่สามารถเปลี่ยนสถานะได้', description: result.error, variant: 'destructive' });
        }
    };

    return (
        <>
                <LawyerPageHeader
                    icon={Briefcase}
                    title="จัดการคดีและลูกความ"
                    description="ติดตามความคืบหน้าของคดี กำหนดนัดศาล และลูกความของคุณ"
                    actions={
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl gap-2 text-white shadow-lg">
                                <Plus className="w-4 h-4" /> เปิดสำนวนคดีใหม่
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[550px] rounded-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-[#002f4b]">เปิดสำนวนคดีใหม่</DialogTitle>
                                <DialogDescription>กรอกข้อมูลเริ่มต้นเพื่อเปิดแฟ้มคดีและบันทึกลงในระบบ</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-3">
                                <div>
                                    <Label className="text-xs font-semibold">ชื่อเรื่อง / ข้อพิพาท *</Label>
                                    <Input placeholder="เช่น ฟ้องผิดสัญญาจ้างทำของ..." value={newTitle} onChange={e => setNewTitle(e.target.value)} className="mt-1" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-semibold">ชื่อลูกความ *</Label>
                                        <Input placeholder="ชื่อบุคคล หรือ นิติบุคคล" value={newClient} onChange={e => setNewClient(e.target.value)} className="mt-1" />
                                    </div>
                                    <div>
                                        <Label className="text-xs font-semibold">ประเภทคดี</Label>
                                        <Select value={newCategory} onValueChange={(val: any) => setNewCategory(val)}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="แพ่ง/พาณิชย์">แพ่ง/พาณิชย์</SelectItem>
                                                <SelectItem value="อาญา">อาญา</SelectItem>
                                                <SelectItem value="แรงงาน">แรงงาน</SelectItem>
                                                <SelectItem value="ทรัพย์สินทางปัญญา">ทรัพย์สินทางปัญญา</SelectItem>
                                                <SelectItem value="มรดก/ครอบครัว">มรดก/ครอบครัว</SelectItem>
                                                <SelectItem value="สัญญาธุรกิจ">สัญญาธุรกิจ</SelectItem>
                                                <SelectItem value="อื่นๆ">อื่นๆ</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-semibold">ศาล / หน่วยงานที่เกี่ยวข้อง</Label>
                                        <Input placeholder="เช่น ศาลแพ่ง, ศาลแรงงาน" value={newCourt} onChange={e => setNewCourt(e.target.value)} className="mt-1" />
                                    </div>
                                    <div>
                                        <Label className="text-xs font-semibold">ค่าวิชาชีพประมาณการ (฿)</Label>
                                        <Input type="number" placeholder="50000" value={newFee} onChange={e => setNewFee(e.target.value)} className="mt-1" />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>ยกเลิก</Button>
                                <Button onClick={handleCreateCase} className="bg-[#002f4b] hover:bg-[#001f35] text-white" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    บันทึกเปิดคดี
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    }
                />

                {/* Pipeline Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(Object.keys(STATUS_LABEL) as CaseStatus[]).map((status) => (
                        <Card key={status} className="rounded-2xl border shadow-sm p-4">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-muted-foreground">{STATUS_LABEL[status].label}</span>
                            </div>
                            <p className="text-2xl font-black text-foreground">{cases.filter(c => c.status === status).length}</p>
                        </Card>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="ค้นหาชื่อคดี หรือชื่อลูกความ..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-10 rounded-xl bg-card border-border/80"
                        />
                    </div>
                    <Select value={selectedStage} onValueChange={setSelectedStage}>
                        <SelectTrigger className="w-full sm:w-[200px] rounded-xl bg-card">
                            <SelectValue placeholder="ทุกสถานะ" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">ทุกสถานะคดี</SelectItem>
                            {(Object.keys(STATUS_LABEL) as CaseStatus[]).map(status => (
                                <SelectItem key={status} value={status}>{STATUS_LABEL[status].label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Cases List */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="p-16 text-center">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                        </div>
                    ) : filteredCases.length > 0 ? (
                        filteredCases.map(caseItem => {
                            const meta = parseMetadata(caseItem.metadata);
                            return (
                                <Card key={caseItem.id} className="rounded-2xl border shadow-sm hover:shadow-md transition-all group overflow-hidden">
                                    <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-[#002f4b] dark:text-blue-400 mt-1 shrink-0">
                                                <Scale className="w-6 h-6" />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                                                        {caseItem.title}
                                                    </h3>
                                                    {meta.category && (
                                                        <Badge variant="secondary" className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800">
                                                            {meta.category}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5" /> ลูกความ: <span className="font-medium text-foreground">{meta.clientName || 'ไม่ระบุ'}</span>
                                                </p>
                                                {meta.court && (
                                                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                                                        <Calendar className="w-3.5 h-3.5" /> {meta.court}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Status & Financials */}
                                        <div className="flex flex-wrap md:flex-col items-end gap-2 shrink-0">
                                            <Select value={caseItem.status} onValueChange={(val: CaseStatus) => handleStatusChange(caseItem.id, val)}>
                                                <SelectTrigger className={`h-8 w-auto rounded-full border text-xs font-semibold px-3 ${STATUS_LABEL[caseItem.status].className}`}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(Object.keys(STATUS_LABEL) as CaseStatus[]).map(status => (
                                                        <SelectItem key={status} value={status}>{STATUS_LABEL[status].label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {!!meta.fee && (
                                                <div className="text-right">
                                                    <p className="text-xs text-muted-foreground">
                                                        ค่าวิชาชีพ: <span className="font-bold text-foreground">฿{meta.fee.toLocaleString()}</span>
                                                    </p>
                                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                                        ชำระแล้ว: ฿{(meta.paid || 0).toLocaleString()} ({Math.round(((meta.paid || 0) / (meta.fee || 1)) * 100)}%)
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    ) : (
                        <div className="p-12 text-center border border-dashed rounded-2xl bg-card">
                            <Briefcase className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                            <h3 className="text-base font-bold text-foreground">ไม่พบข้อมูลคดี</h3>
                            <p className="text-xs text-muted-foreground mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ หรือกด "เปิดสำนวนคดีใหม่"</p>
                        </div>
                    )}
                </div>
            </>
    );
}
