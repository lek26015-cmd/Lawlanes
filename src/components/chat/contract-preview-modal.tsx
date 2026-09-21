'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { FileSignature, ExternalLink, Plus, Maximize2, FileDown, ChevronLeft, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ContractPreviewModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    contractData: any;
    isLawyerView: boolean;
}

export function ContractPreviewModal({ isOpen, onOpenChange, contractData, isLawyerView }: ContractPreviewModalProps) {
    const { toast } = useToast();

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] overflow-hidden rounded-xl p-0 bg-slate-50 dark:bg-slate-900 border-none shadow-2xl flex flex-col">
            <div className="flex-none p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex justify-between items-center z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600 rounded-lg">
                        <FileSignature className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white">สัญญา</DialogTitle>
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", contractData?.status === 'signed' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                {contractData?.status === 'signed' ? "เสร็จสิ้น (Completed)" : "รอการเซ็น (Pending)"}
                            </span>
                        </div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">เลขที่สัญญา: #{contractData?.id?.substring(0, 8) || '...'}</p>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 rounded-full text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => {
                            navigator.clipboard.writeText(`https://capdeal.lawslane.com/th/contract/${contractData?.id}`);
                            toast({ title: 'คัดลอกลิงก์เรียบร้อย', description: 'แชร์ลิงก์นี้ให้คู่สัญญาเพื่อดำเนินการต่อ' });
                        }}
                    >
                        <ExternalLink className="w-4 h-4 mr-1.5" /> แชร์สัญญานี้
                    </Button>
                    {isLawyerView && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 rounded-full text-xs font-bold text-amber-600 border-amber-200 hover:bg-amber-50"
                            onClick={() => {
                                toast({ title: 'ระบบกำลังเปิดหน้าสร้างสัญญา', description: 'กรุณาไปที่ปุ่ม "สัญญา" ในเมนูจัดการด้านขวา' });
                                onOpenChange(false);
                            }}
                        >
                            <Plus className="w-4 h-4 mr-1.5" /> สร้างฉบับแก้ไข
                        </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-9 rounded-full text-xs font-bold" asChild>
                        <a href={`/contract/${contractData?.id}/print`} target="_blank" rel="noopener noreferrer">
                            <Maximize2 className="w-4 h-4 mr-1.5" /> ดูสัญญาเต็มแผ่น
                        </a>
                    </Button>
                    <Button size="sm" className="h-9 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white" asChild>
                        <a href={`/contract/${contractData?.id}/print?print=1`} target="_blank" rel="noopener noreferrer">
                            <FileDown className="w-4 h-4 mr-1.5" /> PDF
                        </a>
                    </Button>
                </div>
                <div className="md:hidden">
                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}><ChevronLeft className="w-6 h-6"/></Button>
                </div>
            </div>

            {contractData && (
                <div className="flex-1 overflow-y-auto flex flex-col md:flex-row gap-6 p-4 md:p-8 bg-slate-100 dark:bg-slate-900/50">
                    
                    {/* Left: A4 Document Area */}
                    <div className="flex-1 flex justify-center">
                        <div className="bg-white dark:bg-slate-950 w-full max-w-[210mm] min-h-[297mm] shadow-xl p-8 md:p-16 flex flex-col relative">
                            {/* Watermark */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none z-0">
                                <FileSignature className="w-96 h-96" />
                            </div>

                            <div className="relative z-10 flex-1 flex flex-col">
                                <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-2">สัญญา</h1>
                                <p className="text-center text-sm text-slate-500 mb-8">(ฉบับย่อ)</p>

                                <div className="space-y-1 mb-8 text-sm md:text-base text-right">
                                    <p>ทำที่ <span className="border-b border-dotted border-slate-400 pb-0.5 px-4 font-medium inline-block min-w-[200px] text-center">ข้อตกลงออนไลน์</span></p>
                                    <p>วันที่ <span className="border-b border-dotted border-slate-400 pb-0.5 px-4 font-medium inline-block min-w-[200px] text-center">
                                        {contractData.createdAt ? new Date(contractData.createdAt?.toDate ? contractData.createdAt.toDate() : contractData.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '................'}
                                    </span></p>
                                </div>

                                <div className="space-y-6 text-sm md:text-base leading-loose text-slate-800 dark:text-slate-300">
                                    <p className="indent-12 text-justify">
                                        สัญญาฉบับนี้ทำขึ้นระหว่าง <span className="font-bold border-b border-dotted border-slate-400 pb-0.5 px-4">{contractData.clientName || 'ลูกความ'}</span>
                                        บัตรประจำตัวประชาชนเลขที่ <span className="border-b border-dotted border-slate-400 pb-0.5 px-8"></span> 
                                        ตั้งอยู่หรืออาศัยอยู่เลขที่ <span className="border-b border-dotted border-slate-400 pb-0.5 px-16"></span> 
                                        ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>&quot;คู่สัญญาฝ่ายที่หนึ่ง&quot;</strong> ฝ่ายหนึ่ง
                                    </p>

                                    <p className="indent-12 text-justify">
                                        กับ <span className="font-bold border-b border-dotted border-slate-400 pb-0.5 px-4">{contractData.lawyerName || 'ทนายความ'}</span> 
                                        บัตรประจำตัวประชาชนเลขที่ <span className="border-b border-dotted border-slate-400 pb-0.5 px-8"></span> 
                                        ตั้งอยู่หรืออาศัยอยู่เลขที่ <span className="border-b border-dotted border-slate-400 pb-0.5 px-16"></span> 
                                        ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>&quot;คู่สัญญาฝ่ายที่สอง&quot;</strong> อีกฝ่ายหนึ่ง
                                    </p>

                                    <p className="indent-12 text-justify">
                                        คู่สัญญาทั้งสองฝ่ายตกลงทำสัญญาฉบับนี้โดยมีข้อความดังต่อไปนี้:
                                    </p>

                                    <div className="pl-4 md:pl-12 space-y-4">
                                        <div>
                                            <p className="font-bold">ข้อ 1. ขอบเขตของงาน (Scope of Work)</p>
                                            <p className="pl-6 pt-2 leading-relaxed whitespace-pre-wrap">{contractData.description || contractData.task || contractData.title}</p>
                                        </div>
                                        <div>
                                            <p className="font-bold">ข้อ 2. ค่าจ้างและเงื่อนไขการชำระเงิน</p>
                                            <p className="pl-6 pt-2">
                                                ผู้ว่าจ้างตกลงชำระค่าจ้างทั้งสิ้น <strong className="text-blue-600">฿{(contractData.price || contractData.amount || 0).toLocaleString()}</strong> บาท
                                            </p>
                                            
                                            {contractData.installments && contractData.installments.length > 0 && (
                                                <div className="mt-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                                    <p className="font-bold mb-2">แผนการชำระเงิน ({contractData.installments.length} งวด)</p>
                                                    <div className="space-y-2">
                                                        {contractData.installments.map((inst: any, idx: number) => {
                                                            const amt = parseFloat(String(inst.amount || 0).replace(/,/g, ''));
                                                            return (
                                                                <div key={idx} className="flex justify-between items-center text-sm pb-2 border-b border-slate-200 dark:border-slate-800 last:border-0 last:pb-0">
                                                                    <span>งวดที่ {idx + 1}: {inst.description}</span>
                                                                    <span className="font-bold text-blue-600">฿{isNaN(amt) ? 0 : amt.toLocaleString()}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <p className="indent-12 text-justify mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                                        สัญญานี้เป็นการสรุปข้อตกลงเบื้องต้นจากการเจรจาผ่านทางแชท คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงได้ลงลายมือชื่อผ่านระบบอิเล็กทรอนิกส์ไว้เป็นสำคัญ
                                    </p>
                                </div>

                                <div className="mt-auto pt-16 flex justify-around">
                                    <div className="text-center space-y-2 flex flex-col items-center">
                                        <div className="h-16 w-40 flex items-center justify-center border-b border-dotted border-slate-400">
                                            {contractData.clientSigned ? (
                                                <span className="text-emerald-600 font-bold italic">ลงนามผ่านระบบแล้ว</span>
                                            ) : (
                                                <span className="text-slate-300 italic text-xs">คลิกเพื่อเซ็นชื่อ</span>
                                            )}
                                        </div>
                                        <p className="font-bold text-sm">ผู้ว่าจ้าง</p>
                                        <p className="text-xs text-slate-500">( {contractData.clientName || 'ลูกความ'} )</p>
                                    </div>
                                    <div className="text-center space-y-2 flex flex-col items-center">
                                        <div className="h-16 w-40 flex items-center justify-center border-b border-dotted border-slate-400">
                                            {contractData.lawyerSigned ? (
                                                <span className="text-emerald-600 font-bold italic">ลงนามผ่านระบบแล้ว</span>
                                            ) : (
                                                <span className="text-slate-300 italic text-xs">คลิกเพื่อเซ็นชื่อ</span>
                                            )}
                                        </div>
                                        <p className="font-bold text-sm">คู่สัญญาฝ่ายที่สอง</p>
                                        <p className="text-xs text-slate-500">( {contractData.lawyerName || 'ทนายความ'} )</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Sidebar */}
                    <div className="w-full md:w-[320px] flex flex-col gap-4 flex-shrink-0">
                        <PartyCard label="คู่สัญญาฝ่ายที่หนึ่ง (PARTY A)" name={contractData.clientName || 'ลูกความ'} signed={contractData.clientSigned} />
                        <PartyCard label="คู่สัญญาฝ่ายที่สอง (PARTY B)" name={contractData.lawyerName || 'ทนายความ'} signed={contractData.lawyerSigned} />

                        <div className="bg-blue-600 rounded-xl p-5 text-white">
                            <div className="flex items-center gap-2 font-bold mb-2">
                                <FileSignature className="w-5 h-5" /> ปลอดภัยและถูกกฎหมาย
                            </div>
                            <p className="text-[11px] opacity-90 leading-relaxed mb-4">
                                สัญญานี้มีผลผูกพันทางกฎหมายตาม พ.ร.บ. ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ ข้อมูลทั้งหมดถูกจัดเก็บอย่างปลอดภัย
                            </p>
                            <Button variant="outline" size="sm" className="w-full text-xs font-bold bg-white/10 hover:bg-white/20 border-white/20 text-white">
                                เรียนรู้เพิ่มเติมเกี่ยวกับ e-Signature
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContent>
      </Dialog>
    );
}

function PartyCard({ label, name, signed }: { label: string; name: string; signed: boolean }) {
    return (
        <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500">{label}</p>
            </div>
            <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 bg-slate-100">
                        <AvatarFallback className="text-slate-500">{name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-bold text-sm">{name}</p>
                        <p className="text-[10px] text-slate-400">ไม่ระบุอีเมล</p>
                    </div>
                </div>
                {signed ? (
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                        <Check className="w-4 h-4" /> ลงนามเรียบร้อยแล้ว
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-amber-600 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4" /> รอการลงนาม
                    </div>
                )}
            </div>
        </div>
    );
}
