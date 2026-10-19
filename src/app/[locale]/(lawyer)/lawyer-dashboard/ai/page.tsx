import { Suspense } from 'react';
import AiWorkspace from '@/components/lawyer/ai/ai-workspace';

// ผู้ช่วย AI งานคดี — รวม "สืบค้นข้อกฎหมาย & ฎีกา" และ "ตรวจร่างสัญญาด้วย AI" เดิมไว้ที่เดียว
export default function LawyerAiPage() {
    return (
        <Suspense fallback={null}>
            <AiWorkspace />
        </Suspense>
    );
}
