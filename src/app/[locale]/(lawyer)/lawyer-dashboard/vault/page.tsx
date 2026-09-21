'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    FolderLock,
    Upload,
    Search,
    FileText,
    File,
    FileSpreadsheet,
    Share2,
    ShieldCheck,
    Lock,
    Copy,
    Check,
    Loader2,
    Trash2,
    Download,
} from 'lucide-react';
import LawyerSidebar from '@/components/layout/lawyer-sidebar';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { getVaultDocsAction, uploadVaultDocAction, deleteVaultDocAction, updateVaultDocShareAction, type VaultDoc } from '@/app/actions/lawyer-vault-actions';

function getFileIcon(type: string) {
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    if (type.startsWith('image/')) return <File className="w-5 h-5 text-blue-500" />;
    return <File className="w-5 h-5 text-slate-400" />;
}

function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LawyerVaultPage() {
    const { toast } = useToast();
    const params = useParams();
    const locale = (params.locale as string) || 'th';

    const [docs, setDocs] = useState<VaultDoc[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [newDocName, setNewDocName] = useState('');
    const [newDocCase, setNewDocCase] = useState('');
    const [newDocFile, setNewDocFile] = useState<File | null>(null);

    const [selectedDoc, setSelectedDoc] = useState<VaultDoc | null>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isShareEnabled, setIsShareEnabled] = useState(false);
    const [isPasswordProtected, setIsPasswordProtected] = useState(false);
    const [password, setPassword] = useState('');
    const [isSavingShare, setIsSavingShare] = useState(false);
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    const fetchDocs = async () => {
        setIsLoading(true);
        try {
            setDocs(await getVaultDocsAction());
        } catch (error) {
            toast({ title: 'โหลดเอกสารไม่สำเร็จ', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDocs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredDocs = docs.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.caseTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalBytes = docs.reduce((sum, d) => sum + d.size, 0);

    const handleUpload = async () => {
        if (!newDocName.trim() || !newDocFile) {
            toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วน', description: 'ระบุชื่อเอกสารและเลือกไฟล์', variant: 'destructive' });
            return;
        }
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.set('name', newDocName);
            formData.set('caseTitle', newDocCase);
            formData.set('file', newDocFile);
            const result = await uploadVaultDocAction(formData);
            if (result.success) {
                toast({ title: 'อัปโหลดสำเร็จ' });
                setIsUploadOpen(false);
                setNewDocName('');
                setNewDocCase('');
                setNewDocFile(null);
                await fetchDocs();
            } else {
                toast({ title: 'อัปโหลดไม่สำเร็จ', description: result.error, variant: 'destructive' });
            }
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (docId: string) => {
        const result = await deleteVaultDocAction(docId);
        if (result.success) {
            await fetchDocs();
        } else {
            toast({ title: 'ลบไม่สำเร็จ', description: result.error, variant: 'destructive' });
        }
    };

    const handleOpenShare = (doc: VaultDoc) => {
        setSelectedDoc(doc);
        setIsShareEnabled(doc.shareEnabled);
        setIsPasswordProtected(doc.hasPassword);
        setPassword('');
        setShareToken(doc.shareToken);
        setIsShareModalOpen(true);
    };

    const handleSaveShare = async () => {
        if (!selectedDoc) return;

        // password: undefined = ไม่แก้รหัสเดิม, null = ล้างรหัส, string = ตั้งรหัสใหม่
        let passwordArg: string | null | undefined;
        if (!isPasswordProtected) {
            passwordArg = null;
        } else if (password) {
            passwordArg = password;
        } else if (!selectedDoc.hasPassword) {
            toast({ title: 'กรุณาตั้งรหัสผ่าน', description: 'เปิดป้องกันด้วยรหัสผ่านแล้วต้องระบุรหัสผ่านด้วย', variant: 'destructive' });
            return;
        } else {
            passwordArg = undefined;
        }

        setIsSavingShare(true);
        try {
            const result = await updateVaultDocShareAction(selectedDoc.id, {
                shareEnabled: isShareEnabled,
                password: passwordArg,
            });
            if (result.success) {
                setShareToken(result.shareToken || null);
                toast({ title: 'บันทึกการตั้งค่าแชร์แล้ว' });
                await fetchDocs();
            } else {
                toast({ title: 'บันทึกไม่สำเร็จ', description: result.error, variant: 'destructive' });
            }
        } finally {
            setIsSavingShare(false);
        }
    };

    const shareLink = shareToken && typeof window !== 'undefined'
        ? `${window.location.origin}/${locale}/vault/share/${shareToken}`
        : '';

    const handleCopyLink = () => {
        if (!shareLink) return;
        navigator.clipboard.writeText(shareLink);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast({
            title: 'คัดลอกลิงก์สำเร็จ',
            description: 'สามารถส่งลิงก์นี้ให้ลูกความเข้าดูเอกสารได้อย่างปลอดภัย',
        });
    };

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <LawyerSidebar />
            <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-[#002f4b] dark:text-blue-400 flex items-center gap-2">
                            <FolderLock className="w-7 h-7" />
                            คลังเอกสารคดี (Case Vault)
                            <Badge variant="outline" className="text-[10px] uppercase font-bold bg-blue-50 text-blue-700 border-blue-200">
                                256-bit AES
                            </Badge>
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            จัดเก็บเอกสารคำฟ้อง พยานหลักฐาน และแชร์ให้ลูกความอย่างปลอดภัยตามมาตรฐานความลับทางวิชาชีพ
                        </p>
                    </div>

                    <Button className="rounded-xl gap-2 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #002f4b, #00466c)' }} onClick={() => setIsUploadOpen(true)}>
                        <Upload className="w-4 h-4" /> อัปโหลดเอกสารคดี
                    </Button>
                </div>

                {/* Storage & Security Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="rounded-2xl border shadow-sm p-4 bg-card/60">
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">เอกสารในคลัง</p>
                        <p className="text-2xl font-black text-foreground mt-1">{docs.length} ฉบับ</p>
                    </Card>

                    <Card className="rounded-2xl border shadow-sm p-4 bg-card/60">
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">พื้นที่ใช้งาน</p>
                        <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{formatSize(totalBytes)}</p>
                    </Card>

                    <Card className="rounded-2xl border shadow-sm p-4 bg-card/60">
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">ความปลอดภัยของระบบ</p>
                        <div className="flex items-center gap-2 mt-1">
                            <ShieldCheck className="w-6 h-6 text-emerald-500" />
                            <span className="text-sm font-bold text-foreground">เข้ารหัสไฟล์ทุกฉบับ (R2 SSE)</span>
                        </div>
                    </Card>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="ค้นหาชื่อเอกสาร หรือชื่อคดี..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10 rounded-xl bg-card border-border/80"
                    />
                </div>

                {/* Documents List */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="p-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="p-12 text-center border border-dashed rounded-2xl bg-card">
                            <FolderLock className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                            <p className="text-sm text-muted-foreground">ยังไม่มีเอกสารในคลัง กด "อัปโหลดเอกสารคดี" เพื่อเริ่มต้น</p>
                        </div>
                    ) : filteredDocs.map(doc => (
                        <Card key={doc.id} className="rounded-2xl border shadow-sm hover:shadow-md transition-all group overflow-hidden">
                            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                                        {getFileIcon(doc.fileType)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                                {doc.name}
                                            </p>
                                            {doc.shareEnabled && (
                                                <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                                    กำลังแชร์อยู่
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {doc.caseTitle && <>สำนวนคดี: <span className="font-medium text-foreground">{doc.caseTitle}</span> &bull; </>}
                                            ขนาด {formatSize(doc.size)} &bull; อัปโหลด {new Date(doc.createdAt).toLocaleDateString('th-TH')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" asChild>
                                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4" /></a>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenShare(doc)}
                                        className="rounded-xl text-xs gap-1.5 h-9"
                                    >
                                        <Share2 className="w-3.5 h-3.5 text-blue-600" /> แชร์ให้ลูกความ
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-300 hover:text-red-500" onClick={() => handleDelete(doc.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Upload Dialog */}
                <Dialog open={isUploadOpen} onOpenChange={(open) => { setIsUploadOpen(open); if (!open) { setNewDocName(''); setNewDocCase(''); setNewDocFile(null); } }}>
                    <DialogContent className="sm:max-w-[500px] rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-[#002f4b]">อัปโหลดเอกสารคดี</DialogTitle>
                            <DialogDescription>รองรับไฟล์รูปภาพและ PDF ขนาดไม่เกิน 15MB</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">ชื่อเอกสาร *</Label>
                                <Input placeholder="เช่น คำฟ้องและเอกสารท้ายคำฟ้อง" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">สำนวนคดีที่เกี่ยวข้อง</Label>
                                <Input placeholder="เช่น ฟ้องผิดสัญญาซื้อขายสินค้า" value={newDocCase} onChange={(e) => setNewDocCase(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">ไฟล์ *</Label>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif,image/heic,application/pdf"
                                    onChange={(e) => setNewDocFile(e.target.files?.[0] || null)}
                                    className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 file:font-bold hover:file:bg-blue-100"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => setIsUploadOpen(false)} disabled={isUploading}>ยกเลิก</Button>
                            <Button className="flex-1 rounded-2xl bg-blue-600" onClick={handleUpload} disabled={isUploading}>
                                {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                อัปโหลด
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Share Modal */}
                <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
                    <DialogContent className="sm:max-w-[500px] rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-[#002f4b] flex items-center gap-2">
                                <Share2 className="w-5 h-5 text-blue-600" />
                                แชร์เอกสารให้ลูกความอย่างปลอดภัย
                            </DialogTitle>
                            <DialogDescription>
                                เอกสาร: <span className="font-semibold text-foreground">{selectedDoc?.name}</span>
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-3">
                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border">
                                <Label className="text-xs font-bold flex items-center gap-1.5">
                                    <Share2 className="w-3.5 h-3.5 text-blue-600" /> เปิดใช้งานลิงก์แชร์
                                </Label>
                                <Switch checked={isShareEnabled} onCheckedChange={setIsShareEnabled} />
                            </div>

                            {isShareEnabled && (
                                <>
                                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold flex items-center gap-1.5">
                                                <Lock className="w-3.5 h-3.5 text-amber-600" /> ป้องกันด้วยรหัสผ่าน
                                            </Label>
                                            <Switch checked={isPasswordProtected} onCheckedChange={setIsPasswordProtected} />
                                        </div>
                                        {isPasswordProtected && (
                                            <div className="pt-2">
                                                <Label className="text-[11px] text-muted-foreground block mb-1">
                                                    {selectedDoc?.hasPassword ? 'ตั้งรหัสผ่านใหม่ (เว้นว่างไว้เพื่อใช้รหัสเดิม)' : 'รหัสผ่านสำหรับลูกความเปิดดูไฟล์'}
                                                </Label>
                                                <Input
                                                    value={password}
                                                    onChange={e => setPassword(e.target.value)}
                                                    placeholder={selectedDoc?.hasPassword ? '••••••••' : ''}
                                                    className="text-xs font-mono rounded-lg h-9"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {shareToken && (
                                        <div>
                                            <Label className="text-xs font-semibold block mb-1.5">ลิงก์เข้าถึงเอกสารสำหรับลูกความ</Label>
                                            <div className="flex gap-2">
                                                <Input readOnly value={shareLink} className="text-xs text-muted-foreground bg-muted/40 rounded-xl" />
                                                <Button onClick={handleCopyLink} className="bg-[#002f4b] hover:bg-[#001f35] text-white rounded-xl gap-1.5 shrink-0">
                                                    {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                                    {isCopied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <DialogFooter>
                            <Button onClick={handleSaveShare} disabled={isSavingShare} className="rounded-xl w-full bg-[#002f4b] text-white">
                                {isSavingShare ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                บันทึกการตั้งค่า
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
