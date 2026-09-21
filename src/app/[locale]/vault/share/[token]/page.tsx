'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Lock, Loader2, Download, ShieldAlert, ShieldCheck } from 'lucide-react';
import { getSharedVaultDocAction } from '@/app/actions/lawyer-vault-actions';

/**
 * หน้าเปิดเอกสารที่ทนายแชร์จากคลังเอกสารคดี — ไม่ต้องล็อกอิน
 * ลิงก์นี้แทนที่ /s/case-vault/{id} เดิมที่ไม่มีหน้ารองรับจริง (404 ตามที่ ECOSYSTEM.md ข้อ 3.5 ระบุไว้)
 */
export default function VaultSharePage() {
    const params = useParams();
    const token = params.token as string;

    const [isLoading, setIsLoading] = useState(true);
    const [needsPassword, setNeedsPassword] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
    const [error, setError] = useState('');
    const [doc, setDoc] = useState<{ name: string; fileUrl: string; fileType: string } | null>(null);

    const load = async (password?: string) => {
        try {
            const result = await getSharedVaultDocAction(token, password);
            if (result.success) {
                setDoc({ name: result.name!, fileUrl: result.fileUrl!, fileType: result.fileType! });
                setNeedsPassword(false);
                setError('');
            } else if (result.requiresPassword) {
                setNeedsPassword(true);
                if (password) setPasswordError(result.error || 'รหัสผ่านไม่ถูกต้อง');
            } else {
                setError(result.error || 'ไม่พบเอกสาร');
            }
        } catch {
            setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        }
    };

    useEffect(() => {
        setIsLoading(true);
        load().finally(() => setIsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const handleSubmitPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingPassword(true);
        setPasswordError('');
        await load(passwordInput);
        setIsSubmittingPassword(false);
    };

    const isImage = doc?.fileType.startsWith('image/');

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {isLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : error ? (
                    <Card className="rounded-3xl border-none shadow-lg">
                        <CardContent className="p-12 text-center space-y-3">
                            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
                            <p className="font-bold text-slate-900">{error}</p>
                        </CardContent>
                    </Card>
                ) : needsPassword ? (
                    <Card className="rounded-3xl border-none shadow-lg">
                        <CardHeader className="text-center">
                            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-2 text-amber-600">
                                <Lock className="w-7 h-7" />
                            </div>
                            <CardTitle>เอกสารนี้ถูกป้องกันด้วยรหัสผ่าน</CardTitle>
                            <CardDescription>กรอกรหัสผ่านที่ได้รับจากทนายความเพื่อเปิดดูเอกสาร</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmitPassword} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">รหัสผ่าน</Label>
                                    <Input type="text" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} autoFocus />
                                    {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
                                </div>
                                <Button type="submit" className="w-full rounded-xl bg-[#002f4b]" disabled={isSubmittingPassword}>
                                    {isSubmittingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    เปิดเอกสาร
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                ) : doc ? (
                    <Card className="rounded-3xl border-none shadow-lg overflow-hidden">
                        <div className="p-4 bg-white border-b flex items-center gap-2 text-xs text-emerald-600 font-bold">
                            <ShieldCheck className="w-4 h-4" /> เชื่อมต่ออย่างปลอดภัยผ่าน Lawslane Case Vault
                        </div>
                        {isImage ? (
                            <img src={doc.fileUrl} alt={doc.name} className="w-full max-h-[70vh] object-contain bg-slate-900" />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 gap-4">
                                <FileText className="w-16 h-16 text-slate-300" />
                                <p className="font-bold text-slate-900">{doc.name}</p>
                            </div>
                        )}
                        <CardContent className="p-6 flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-700 truncate">{doc.name}</p>
                            <Button asChild className="rounded-xl bg-[#002f4b] shrink-0">
                                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4 mr-2" /> ดาวน์โหลด</a>
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </div>
    );
}
