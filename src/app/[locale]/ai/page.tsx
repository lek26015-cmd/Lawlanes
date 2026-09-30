import { Suspense } from 'react';
import type { Metadata } from 'next';
import AiWorkspace from '@/components/lawyer/ai/ai-workspace';

// Lawslane AI สำหรับลูกค้าทั่วไป — แทนแชทลลินเดิม · ใช้หน้าจอ/ระบบเครดิตชุดเดียวกับผู้ช่วย AI ของทนาย (audience = customer)
// ต้องล็อกอิน (หน้าจอขึ้นปุ่มเข้าสู่ระบบเองถ้ายังไม่ล็อกอิน) · เครดิตฟรีรายเดือนตามแพ็กเกจลูกค้า (lib/customer-ai-plan.ts)
export const metadata: Metadata = {
    title: 'Lawslane AI — ผู้ช่วยกฎหมาย',
    description: 'เล่าปัญหากฎหมายเป็นภาษาปกติ Lawslane AI อธิบายกฎหมายที่เกี่ยวข้องพร้อมตัวบทอ้างอิง ช่วยร่างหนังสือ และอ่านสัญญาก่อนเซ็น',
};

export default function CustomerAiPage() {
    return (
        <Suspense fallback={null}>
            <AiWorkspace audience="customer" />
        </Suspense>
    );
}
