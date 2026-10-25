'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { doc, updateDoc } from 'firebase/firestore';
import { Landmark, Building2, PenSquare, X, Save, Loader2, AlertCircle, Info, FileText, Wallet } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { Link } from '@/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getLawyerFinancialsAction } from '@/app/actions/dashboard-actions';
import LawyerPageHeader, { LawyerPageLoading } from '@/components/lawyer/lawyer-page-header';
import bblLogo from '@/pic/logo-bank/กรุงเทพ.png';
import kbankLogo from '@/pic/logo-bank/กสิกร.png';
import ktbLogo from '@/pic/logo-bank/กรุงไทย.png';
import scbLogo from '@/pic/logo-bank/ไทยพาณิช.png';
import bayLogo from '@/pic/logo-bank/กรุงศรี.png';
import ttbLogo from '@/pic/logo-bank/ttb.png';
import gsbLogo from '@/pic/logo-bank/ออมสิน.png';
import baacLogo from '@/pic/logo-bank/ธนาคาร ธกส.png';
import cimbLogo from '@/pic/logo-bank/Cimb.png';
import uobLogo from '@/pic/logo-bank/UOB.png';
import tiscoLogo from '@/pic/logo-bank/ทิสโก้.png';
import ibankLogo from '@/pic/logo-bank/ธนาคารอิสลาม.png';
import ghbLogo from '@/pic/logo-bank/ธอส.png';
import kkpLogo from '@/pic/logo-bank/เกียรตินาคิน.png';
import lhLogo from '@/pic/logo-bank/แลนด์แลนด์เฮ้าท์ .png';
import icbcLogo from '@/pic/logo-bank/ICBC.png';
import bocLogo from '@/pic/logo-bank/ธนาคารแห่งประเทศจีน.png';

const banks = [
    { name: "ธนาคารกรุงเทพ", logo: bblLogo, color: "#1e4598" },
    { name: "ธนาคารกสิกรไทย", logo: kbankLogo, color: "#138f2d" },
    { name: "ธนาคารกรุงไทย", logo: ktbLogo, color: "#1ba5e1" },
    { name: "ธนาคารไทยพาณิชย์", logo: scbLogo, color: "#4e2e7f" },
    { name: "ธนาคารกรุงศรีอยุธยา", logo: bayLogo, color: "#fec43b" },
    { name: "ธนาคารทหารไทยธนชาต", logo: ttbLogo, color: "#102a4d" },
    { name: "ธนาคารออมสิน", logo: gsbLogo, color: "#eb198d" },
    { name: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร", logo: baacLogo, color: "#4b9b1d" },
    { name: "ธนาคารซีไอเอ็มบี ไทย", logo: cimbLogo, color: "#7e2f36" },
    { name: "ธนาคารยูโอบี", logo: uobLogo, color: "#0b3979" },
    { name: "ธนาคารทิสโก้", logo: tiscoLogo, color: "#1a4d8d" },
    { name: "ธนาคารอิสลามแห่งประเทศไทย", logo: ibankLogo, color: "#164134" },
    { name: "ธนาคารอาคารสงเคราะห์", logo: ghbLogo, color: "#f58523" },
    { name: "ธนาคารเกียรตินาคินภัทร", logo: kkpLogo, color: "#6e5a9c" },
    { name: "ธนาคารแลนด์ แอนด์ เฮ้าส์", logo: lhLogo, color: "#6d6e71" },
    { name: "ธนาคารไอซีบีซี (ไทย)", logo: icbcLogo, color: "#c4161c" },
    { name: "ธนาคารแห่งประเทศจีน (ไทย)", logo: bocLogo, color: "#b40026" },
];

type Platform = { gross: number; gp: number; held: number; due: number; paidOut: number; pendingReview: number };
type PlatformPayment = {
    id: string; chatId: string; caseTitle: string; description: string;
    grossAmount: number; gpPercent: number; gpAmount: number; netToLawyer: number;
    status: string; payoutStatus: string; createdAt: string | null;
};

const satang = (n: number) => `฿${(n / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

function paymentStatusLabel(p: PlatformPayment): string {
    if (p.status === 'pending_review') return 'รอทีมงานตรวจสลิป';
    if (p.status === 'refund_pending') return 'เคสยกเลิก · รอคืนลูกความ';
    if (p.status === 'refunded') return 'คืนลูกความแล้ว';
    if (p.status === 'rejected') return 'สลิปไม่ผ่าน';
    if (p.payoutStatus === 'held') return 'รอปิดเคส';
    if (p.payoutStatus === 'due') return 'รอ Lawslane โอนให้คุณ';
    if (p.payoutStatus === 'paid') return 'โอนให้คุณแล้ว';
    return p.status;
}

// ค่าบริการที่ลูกความชำระเข้าบัญชี Lawslane (PLAN-10) — Lawslane หัก GP แล้วโอนยอดสุทธิให้ทนายหลังปิดเคส
// เข้าบัญชีรับเงินในหน้านี้ + ข้อมูลออกใบกำกับภาษี
export default function LawyerFinancialsPage() {
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [lawyerOfficialName, setLawyerOfficialName] = useState('');
    const [profileId, setProfileId] = useState('');
    const [platform, setPlatform] = useState<Platform | null>(null);
    const [platformPayments, setPlatformPayments] = useState<PlatformPayment[]>([]);

    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [isEditingBank, setIsEditingBank] = useState(false);
    const [editBankName, setEditBankName] = useState('');
    const [editAccountNumber, setEditAccountNumber] = useState('');
    const [editAccountName, setEditAccountName] = useState('');
    const [isSavingBank, setIsSavingBank] = useState(false);

    const [corporateName, setCorporateName] = useState('');
    const [corporateTaxId, setCorporateTaxId] = useState('');
    const [corporateAddress, setCorporateAddress] = useState('');
    const [isEditingCorporate, setIsEditingCorporate] = useState(false);
    const [editCorporateName, setEditCorporateName] = useState('');
    const [editCorporateTaxId, setEditCorporateTaxId] = useState('');
    const [editCorporateAddress, setEditCorporateAddress] = useState('');
    const [isSavingCorporate, setIsSavingCorporate] = useState(false);

    const fetchProfile = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const { profile, platform, platformPayments } = await getLawyerFinancialsAction();
            setLawyerOfficialName(profile.name);
            setProfileId(profile.profileId);
            setPlatform(platform);
            setPlatformPayments(platformPayments);
            setBankName(profile.bankName); setEditBankName(profile.bankName);
            setAccountNumber(profile.bankAccountNumber); setEditAccountNumber(profile.bankAccountNumber);
            setAccountName(profile.bankAccountName); setEditAccountName(profile.bankAccountName);
            setCorporateName(profile.corporateName); setEditCorporateName(profile.corporateName);
            setCorporateTaxId(profile.corporateTaxId); setEditCorporateTaxId(profile.corporateTaxId);
            setCorporateAddress(profile.corporateAddress); setEditCorporateAddress(profile.corporateAddress);
        } catch (error) {
            console.error('Error fetching lawyer profile:', error);
            toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถโหลดข้อมูลได้' });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (!isUserLoading && user) fetchProfile();
    }, [isUserLoading, user, fetchProfile]);

    const handleUpdateBankDetails = async () => {
        if (!firestore || !user) return;
        if (!editBankName || !editAccountNumber || !editAccountName) {
            toast({ variant: 'destructive', title: 'ข้อมูลไม่ครบถ้วน', description: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
            return;
        }
        if (editAccountName !== lawyerOfficialName) {
            toast({ variant: 'destructive', title: 'ชื่อบัญชีไม่ถูกต้อง', description: `ชื่อบัญชีต้องตรงกับชื่อที่ลงทะเบียน: ${lawyerOfficialName}` });
            return;
        }
        setIsSavingBank(true);
        try {
            // doc id ของโปรไฟล์ไม่จำเป็นต้องเท่ากับ uid — ใช้ id ที่ server ตรวจแล้ว
            await updateDoc(doc(firestore, 'lawyerProfiles', profileId || user.uid), {
                bankName: editBankName,
                bankAccountNumber: editAccountNumber,
                bankAccountName: editAccountName,
            });
            setBankName(editBankName); setAccountNumber(editAccountNumber); setAccountName(editAccountName);
            setIsEditingBank(false);
            toast({ title: 'บันทึกข้อมูลสำเร็จ', description: 'ข้อมูลบัญชีธนาคารของคุณถูกอัปเดตแล้ว' });
        } catch (error) {
            console.error('Error updating bank details:', error);
            toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถบันทึกข้อมูลได้' });
        } finally {
            setIsSavingBank(false);
        }
    };

    const handleUpdateCorporateDetails = async () => {
        if (!firestore || !user) return;
        if (!editCorporateName || !editCorporateTaxId || !editCorporateAddress) {
            toast({ variant: 'destructive', title: 'ข้อมูลไม่ครบถ้วน', description: 'กรุณากรอกข้อมูลนิติบุคคลให้ครบทุกช่อง' });
            return;
        }
        setIsSavingCorporate(true);
        try {
            await updateDoc(doc(firestore, 'lawyerProfiles', profileId || user.uid), {
                corporateName: editCorporateName,
                corporateTaxId: editCorporateTaxId,
                corporateAddress: editCorporateAddress,
            });
            setCorporateName(editCorporateName); setCorporateTaxId(editCorporateTaxId); setCorporateAddress(editCorporateAddress);
            setIsEditingCorporate(false);
            toast({ title: 'บันทึกข้อมูลสำเร็จ', description: 'ข้อมูลนิติบุคคลสำหรับการออกใบกำกับภาษีถูกอัปเดตแล้ว' });
        } catch (error) {
            console.error('Error updating corporate details:', error);
            toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถบันทึกข้อมูลได้' });
        } finally {
            setIsSavingCorporate(false);
        }
    };

    if (isUserLoading || isLoading) return <LawyerPageLoading />;

    const bankLogo = banks.find(b => b.name === bankName)?.logo;

    return (
        <>
            <LawyerPageHeader
                icon={Wallet}
                title="รายได้และบัญชีรับเงิน"
                description="ค่าบริการที่ลูกความชำระผ่าน Lawslane และบัญชีที่ Lawslane โอนเงินให้คุณ"
                actions={
                    <Link href="/lawyer-dashboard/billing">
                        <Button variant="outline" className="rounded-xl gap-2">
                            <FileText className="w-4 h-4" /> ใบแจ้งหนี้ของฉัน
                        </Button>
                    </Link>
                }
            />

            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-200">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p>ลูกความชำระค่าบริการเข้าบัญชี Lawslane · Lawslane หักค่าธรรมเนียมแพลตฟอร์ม (GP) แล้วโอนยอดสุทธิเข้าบัญชีรับเงินของคุณหลังคุณปิดเคส</p>
            </div>

            {platform && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'รอปิดเคส', value: platform.held, hint: 'ยอดสุทธิของเคสที่ยังไม่ปิด' },
                        { label: 'รอ Lawslane โอน', value: platform.due, hint: 'ปิดเคสแล้ว กำลังดำเนินการโอน' },
                        { label: 'โอนให้คุณแล้ว', value: platform.paidOut, hint: 'รวมทั้งหมด' },
                        { label: 'GP ที่หักแล้ว', value: platform.gp, hint: `จากยอดรวม ${satang(platform.gross)}` },
                    ].map(c => (
                        <Card key={c.label} className="rounded-2xl border shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">{c.label}</p>
                                <p className="text-xl font-bold mt-1">{satang(c.value)}</p>
                                <p className="text-[11px] text-muted-foreground mt-1">{c.hint}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {platformPayments.length > 0 && (
                <Card className="rounded-2xl border shadow-sm">
                    <CardHeader className="border-b">
                        <CardTitle className="text-base font-bold">ค่าบริการที่ชำระผ่าน Lawslane</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 divide-y">
                        {platformPayments.map(p => (
                            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
                                <div className="min-w-0">
                                    <Link href={`/chat/${p.chatId}?view=lawyer`} className="font-medium hover:underline">{p.caseTitle || 'เคส'}</Link>
                                    <p className="text-xs text-muted-foreground">{p.description}{p.createdAt ? ` · ${new Date(p.createdAt).toLocaleDateString('th-TH')}` : ''}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold">{satang(p.netToLawyer)} <span className="text-xs font-normal text-muted-foreground">สุทธิ</span></p>
                                    <p className="text-[11px] text-muted-foreground">ยอดเต็ม {satang(p.grossAmount)} · GP {p.gpPercent}% {satang(p.gpAmount)}</p>
                                    <p className="text-[11px] font-medium text-[#002f4b] dark:text-blue-300">{paymentStatusLabel(p)}</p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* บัญชีรับเงิน */}
                <Card className="rounded-2xl border shadow-sm">
                    <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
                        <div>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Landmark className="w-4 h-4 text-[#002f4b] dark:text-blue-400" /> บัญชีรับเงิน
                            </CardTitle>
                            <CardDescription className="mt-1">Lawslane โอนค่าบริการเข้าบัญชีนี้ · ชื่อบัญชีต้องตรงกับชื่อที่ลงทะเบียนทนาย</CardDescription>
                        </div>
                        {!isEditingBank ? (
                            <Button variant="outline" size="sm" onClick={() => setIsEditingBank(true)} className="rounded-xl shrink-0">
                                <PenSquare className="w-4 h-4 mr-1.5" /> แก้ไข
                            </Button>
                        ) : (
                            <Button variant="ghost" size="sm" onClick={() => setIsEditingBank(false)} className="rounded-xl shrink-0 text-red-600 hover:bg-red-50">
                                <X className="w-4 h-4 mr-1.5" /> ยกเลิก
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-6">
                        {isEditingBank ? (
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>ธนาคาร</Label>
                                    <Select value={editBankName} onValueChange={setEditBankName}>
                                        <SelectTrigger className="h-10"><SelectValue placeholder="เลือกธนาคาร" /></SelectTrigger>
                                        <SelectContent>
                                            {banks.map((bank) => (
                                                <SelectItem key={bank.name} value={bank.name}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative w-6 h-6 rounded-lg overflow-hidden border">
                                                            <Image src={bank.logo} alt={bank.name} fill className="object-cover" />
                                                        </div>
                                                        <span className="text-sm">{bank.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>เลขที่บัญชี</Label>
                                    <Input value={editAccountNumber} onChange={e => setEditAccountNumber(e.target.value)} placeholder="เลขบัญชี 10-12 หลัก" inputMode="numeric" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>ชื่อบัญชี</Label>
                                    <Input value={editAccountName} onChange={e => setEditAccountName(e.target.value)} placeholder={lawyerOfficialName || 'ชื่อ-นามสกุลเจ้าของบัญชี'} />
                                </div>
                                <Button onClick={handleUpdateBankDetails} disabled={isSavingBank} className="w-full rounded-xl bg-[#002f4b] hover:bg-[#00466c] text-white">
                                    {isSavingBank ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    บันทึกบัญชี
                                </Button>
                            </div>
                        ) : bankName ? (
                            <dl className="space-y-3 text-sm">
                                <div className="flex justify-between gap-4">
                                    <dt className="text-muted-foreground">ธนาคาร</dt>
                                    <dd className="font-medium flex items-center gap-2 text-right">
                                        {bankLogo && (
                                            <span className="relative w-5 h-5 rounded overflow-hidden shrink-0">
                                                <Image src={bankLogo} alt={bankName} fill className="object-cover" />
                                            </span>
                                        )}
                                        {bankName}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <dt className="text-muted-foreground">เลขที่บัญชี</dt>
                                    <dd className="font-medium tracking-wider">{accountNumber || '-'}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <dt className="text-muted-foreground">ชื่อบัญชี</dt>
                                    <dd className="font-medium text-right">{accountName || '-'}</dd>
                                </div>
                            </dl>
                        ) : (
                            <button type="button" onClick={() => setIsEditingBank(true)} className="w-full flex items-center gap-2 text-amber-700 text-sm bg-amber-50 p-3 rounded-xl hover:bg-amber-100 transition-colors text-left">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                ยังไม่มีข้อมูลบัญชี — เพิ่มบัญชีเพื่อให้ Lawslane โอนค่าบริการให้คุณได้
                            </button>
                        )}
                    </CardContent>
                </Card>

                {/* ข้อมูลออกใบกำกับภาษี */}
                <Card className="rounded-2xl border shadow-sm">
                    <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
                        <div>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-[#002f4b] dark:text-blue-400" /> ข้อมูลนิติบุคคล
                            </CardTitle>
                            <CardDescription className="mt-1">ใช้ออกใบกำกับภาษีเต็มรูปแบบและหนังสือรับรองการหัก ณ ที่จ่าย (ถ้ามี)</CardDescription>
                        </div>
                        {!isEditingCorporate ? (
                            <Button variant="outline" size="sm" onClick={() => setIsEditingCorporate(true)} className="rounded-xl shrink-0">
                                <PenSquare className="w-4 h-4 mr-1.5" /> แก้ไข
                            </Button>
                        ) : (
                            <Button variant="ghost" size="sm" onClick={() => setIsEditingCorporate(false)} className="rounded-xl shrink-0 text-red-600 hover:bg-red-50">
                                <X className="w-4 h-4 mr-1.5" /> ยกเลิก
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-6">
                        {isEditingCorporate ? (
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>ชื่อนิติบุคคล / สำนักงาน <span className="text-red-500">*</span></Label>
                                    <Input value={editCorporateName} onChange={e => setEditCorporateName(e.target.value)} placeholder="เช่น สำนักงานกฎหมาย ..." />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>เลขประจำตัวผู้เสียภาษีอากร 13 หลัก <span className="text-red-500">*</span></Label>
                                    <Input value={editCorporateTaxId} onChange={e => setEditCorporateTaxId(e.target.value)} placeholder="0123456789012" maxLength={13} inputMode="numeric" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>ที่อยู่จดทะเบียน <span className="text-red-500">*</span></Label>
                                    <Input value={editCorporateAddress} onChange={e => setEditCorporateAddress(e.target.value)} placeholder="ที่อยู่สำหรับออกใบกำกับภาษี" />
                                </div>
                                <Button onClick={handleUpdateCorporateDetails} disabled={isSavingCorporate} className="w-full rounded-xl bg-[#002f4b] hover:bg-[#00466c] text-white">
                                    {isSavingCorporate ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    บันทึกข้อมูลนิติบุคคล
                                </Button>
                            </div>
                        ) : corporateName ? (
                            <dl className="space-y-3 text-sm">
                                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">ชื่อ</dt><dd className="font-medium text-right">{corporateName}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">เลขผู้เสียภาษี</dt><dd className="font-medium tracking-wider">{corporateTaxId || '-'}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-muted-foreground shrink-0">ที่อยู่</dt><dd className="font-medium text-right">{corporateAddress || '-'}</dd></div>
                            </dl>
                        ) : (
                            <p className="text-sm text-muted-foreground">ยังไม่ได้กรอก — ใส่เฉพาะกรณีออกใบกำกับภาษีในนามนิติบุคคล</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
