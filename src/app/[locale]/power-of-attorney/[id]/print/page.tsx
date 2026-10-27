'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPowerOfAttorneyForPrintAction } from '@/app/actions/power-of-attorney-actions';
import { PowerOfAttorneyDocument } from '@/components/legal-docs/power-of-attorney-document';
import type { PoaView } from '@/lib/power-of-attorney';

// หน้าพิมพ์หนังสือมอบอำนาจ / ใบแต่งทนายความ — ต้องล็อกอินเป็นทนายหรือลูกความของคดี (มีเลขบัตรประชาชน)
export default function PowerOfAttorneyPrintPage() {
    const { id } = useParams<{ id: string }>();
    const [poa, setPoa] = useState<PoaView | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getPowerOfAttorneyForPrintAction(id).then(res => {
            if (res.success) setPoa(res.poa);
            else setError(res.error);
        });
    }, [id]);

    if (error) {
        return <div className="flex h-screen items-center justify-center font-bold text-red-500">{error}</div>;
    }
    if (!poa) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                <p className="font-bold text-slate-500">กำลังเตรียมเอกสาร...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 pb-16 print:bg-white print:p-0">
            <div className="sticky top-0 z-50 mb-8 flex items-center justify-between border-b bg-white p-4 shadow-sm print:hidden">
                <div>
                    <h1 className="font-bold text-slate-800">{poa.caseTitle || 'หนังสือมอบอำนาจ'}</h1>
                    <p className="text-xs text-slate-500">
                        {poa.status === 'ready'
                            ? 'พิมพ์ ลงลายมือชื่อด้วยปากกา ติดอากรแสตมป์ และแนบสำเนาบัตรของผู้มอบอำนาจ'
                            : 'ร่าง — ลูกความยังไม่ได้ยืนยัน'}
                    </p>
                </div>
                <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> พิมพ์ / บันทึก PDF</Button>
            </div>
            <div className="px-4 print:px-0">
                <PowerOfAttorneyDocument poa={poa} />
            </div>

            <style jsx global>{`
                @media print {
                    @page { margin: 20mm 18mm; size: A4 portrait; }
                    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    header, nav, footer, .sticky, .fixed, [class*="fixed"] { display: none !important; }
                    /* จอแคบย่อหน้ากระดาษด้วย scale — ตอนพิมพ์ใช้ขนาดจริง (เนื้อที่ 174mm เท่ากับบนจอ บรรทัดตัดตรงกัน) */
                    .poa-fit { height: auto !important; }
                    .poa-fit-inner { transform: none !important; width: auto !important; }
                    .poa-page { break-after: page; }
                    .poa-page:last-child { break-after: auto; }
                }
            `}</style>
        </div>
    );
}
