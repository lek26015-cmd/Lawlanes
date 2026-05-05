'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getContractByIdAction } from '@/app/actions/billing-actions';
import { Loader2, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import logoColor from '@/pic/logo-lawslane-transparent-color.png';

export default function ContractPrintPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const contractId = params.id as string;
    const autoPrint = searchParams.get('print') === '1';
    
    const [contract, setContract] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchContract = async () => {
            try {
                const res = await getContractByIdAction(contractId);
                if (res.success && res.data) {
                    setContract(res.data);
                } else {
                    setError('ไม่พบสัญญา หรือคุณไม่มีสิทธิ์เข้าถึง');
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (contractId) {
            fetchContract();
        }
    }, [contractId]);

    // Automatically trigger print when loaded
    useEffect(() => {
        if (autoPrint && !loading && contract && !error) {
            setTimeout(() => {
                window.print();
            }, 1000);
        }
    }, [loading, contract, error, autoPrint]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center flex-col gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                <p className="font-bold text-slate-500">กำลังเตรียมเอกสาร...</p>
            </div>
        );
    }

    if (error || !contract) {
        return (
            <div className="flex h-screen w-full items-center justify-center flex-col gap-4">
                <p className="font-bold text-red-500 text-xl">{error || 'ไม่พบเอกสาร'}</p>
            </div>
        );
    }

    const price = contract.price || contract.amount || 0;

    return (
        <div className="bg-slate-100 min-h-screen pb-16 text-black print:p-0 print:bg-white">
            {/* Top Toolbar (Hidden in Print) */}
            <div className="sticky top-0 z-50 bg-white border-b border-slate-200 p-4 flex justify-between items-center print:hidden shadow-sm mb-8">
                <div>
                    <h1 className="font-bold text-slate-800">เอกสารสัญญา</h1>
                    <p className="text-xs text-slate-500">#{contractId}</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => window.close()} variant="outline">ปิดหน้าต่าง</Button>
                    <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Printer className="w-4 h-4 mr-2" /> พิมพ์ / บันทึก PDF
                    </Button>
                </div>
            </div>

            <div className="max-w-[210mm] mx-auto min-h-[297mm] flex flex-col relative bg-white shadow-xl p-8 md:p-16 print:max-w-none print:w-full print:shadow-none print:p-0">
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <div className="opacity-[0.03] print:opacity-[0.05] w-96 h-96 relative grayscale">
                        <Image src={logoColor} alt="Lawslane Watermark" fill className="object-contain" />
                    </div>
                </div>

                <div className="relative z-10 flex-1 flex flex-col">
                    <h1 className="text-3xl font-bold text-center text-slate-900 mb-2">สัญญา</h1>
                    <p className="text-center text-sm text-slate-500 mb-8">(ฉบับย่อ)</p>

                    <div className="space-y-1 mb-8 text-sm md:text-base text-right">
                        <p>ทำที่ <span className="border-b border-dotted border-slate-400 pb-0.5 px-4 font-medium inline-block min-w-[200px] text-center">ข้อตกลงออนไลน์ (Lawslane)</span></p>
                        <p>วันที่ <span className="border-b border-dotted border-slate-400 pb-0.5 px-4 font-medium inline-block min-w-[200px] text-center">
                            {contract.createdAt ? new Date(contract.createdAt?.toDate ? contract.createdAt.toDate() : contract.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '................'}
                        </span></p>
                    </div>

                    <div className="space-y-6 text-sm md:text-base leading-loose text-slate-800">
                        <p className="indent-12 text-justify">
                            สัญญาฉบับนี้ทำขึ้นระหว่าง <span className="font-bold border-b border-dotted border-slate-400 pb-0.5 px-4">{contract.clientName || 'ลูกความ'}</span>
                            บัตรประจำตัวประชาชนเลขที่ <span className="inline-block border-b border-dotted border-slate-400 pb-0.5 px-8 min-w-[150px] text-center"></span> 
                            ตั้งอยู่หรืออาศัยอยู่เลขที่ <span className="inline-block border-b border-dotted border-slate-400 pb-0.5 px-16 min-w-[200px] text-center"></span> 
                            ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>"คู่สัญญาฝ่ายที่หนึ่ง"</strong> ฝ่ายหนึ่ง
                        </p>

                        <p className="indent-12 text-justify">
                            กับ <span className="font-bold border-b border-dotted border-slate-400 pb-0.5 px-4">{contract.lawyerName || 'ทนายความ'}</span> 
                            บัตรประจำตัวประชาชนเลขที่ <span className="inline-block border-b border-dotted border-slate-400 pb-0.5 px-8 min-w-[150px] text-center"></span> 
                            ตั้งอยู่หรืออาศัยอยู่เลขที่ <span className="inline-block border-b border-dotted border-slate-400 pb-0.5 px-16 min-w-[200px] text-center"></span> 
                            ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>"คู่สัญญาฝ่ายที่สอง"</strong> อีกฝ่ายหนึ่ง
                        </p>

                        <p className="indent-12 text-justify">
                            คู่สัญญาทั้งสองฝ่ายตกลงทำสัญญาฉบับนี้โดยมีข้อความดังต่อไปนี้:
                        </p>

                        <div className="pl-4 md:pl-12 space-y-4">
                            <div>
                                <p className="font-bold">ข้อ 1. ขอบเขตของงาน (Scope of Work)</p>
                                <p className="pl-6 pt-2 leading-relaxed whitespace-pre-wrap">{contract.description || contract.task || contract.title}</p>
                            </div>
                            <div>
                                <p className="font-bold">ข้อ 2. ค่าจ้างและเงื่อนไขการชำระเงิน</p>
                                <p className="pl-6 pt-2">
                                    ผู้ว่าจ้างตกลงชำระค่าจ้างทั้งสิ้น <strong className="text-black">฿{price.toLocaleString()}</strong> บาท
                                </p>
                            </div>
                        </div>

                        <p className="indent-12 text-justify mt-8 pt-8 border-t border-slate-200">
                            สัญญานี้เป็นการสรุปข้อตกลงเบื้องต้นจากการเจรจาผ่านทางแชทบนระบบ Lawslane คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงได้ลงลายมือชื่อผ่านระบบอิเล็กทรอนิกส์ไว้เป็นสำคัญ
                        </p>
                    </div>

                    <div className="mt-16 pt-8 flex justify-around">
                        <div className="text-center space-y-2 flex flex-col items-center">
                            <div className="h-16 w-40 flex items-center justify-center border-b border-dotted border-slate-400 mb-2">
                                {contract.clientSigned || contract.clientSignatureImage ? (
                                    contract.clientSignatureImage ? (
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            <img src={contract.clientSignatureImage} alt="Client Signature" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                        </div>
                                    ) : (
                                        <span className="text-slate-600 font-bold italic">ลงนามผ่านระบบแล้ว</span>
                                    )
                                ) : (<span className="text-[10px] text-slate-300 italic">รอลงนาม</span>)}
                            </div>
                            <p className="font-bold text-sm">ผู้ว่าจ้าง</p>
                            <p className="text-xs text-slate-500">( {contract.clientName || 'ลูกความ'} )</p>
                        </div>
                        <div className="text-center space-y-2 flex flex-col items-center">
                            <div className="h-16 w-40 flex items-center justify-center border-b border-dotted border-slate-400 mb-2">
                                {contract.lawyerSigned || contract.lawyerSignatureImage ? (
                                    contract.lawyerSignatureImage ? (
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            <img src={contract.lawyerSignatureImage} alt="Lawyer Signature" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                        </div>
                                    ) : (
                                        <span className="text-slate-600 font-bold italic">ลงนามผ่านระบบแล้ว</span>
                                    )
                                ) : (<span className="text-[10px] text-slate-300 italic">รอลงนาม</span>)}
                            </div>
                            <p className="font-bold text-sm">คู่สัญญาฝ่ายที่สอง</p>
                            <p className="text-xs text-slate-500">( {contract.lawyerName || 'ทนายความ'} )</p>
                        </div>
                    </div>
                    
                    <div className="mt-16 text-center text-[10px] text-slate-400">
                        เอกสารฉบับนี้ถูกสร้างและรับรองโดยระบบอัตโนมัติของ Lawslane Platform (Ref: #{contract.id})
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page { margin: 15mm; size: A4 portrait; }
                    body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; width: auto !important; height: auto !important; }
                    html, body { overflow: visible !important; min-height: auto !important; }
                    header, nav, footer, .sticky, .fixed, [class*="fixed"] { display: none !important; }
                    ::-webkit-scrollbar { display: none; }
                    
                    /* Ensure fonts and text wrapping are perfect for print */
                    p, div, span, h1, h2, h3 { 
                        color: black !important; 
                        word-break: break-word; 
                    }
                    strong, b { font-weight: 800 !important; }
                }
            `}</style>
        </div>
    );
}
