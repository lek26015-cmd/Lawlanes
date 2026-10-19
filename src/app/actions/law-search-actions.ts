'use server';

import { retrieveDocuments } from '@/lib/rag';
import { requireLawyerFeature } from '@/lib/lawyer-plan-access';
import { limitUserAction } from '@/lib/security/action-rate-limit';

// ค้นเอกสารกฎหมายดิบ (ไม่ผ่าน LLM) สำหรับเครื่องมือค้นคว้าในหน้าเคสของทนาย
// เดิม component เรียก retrieveDocuments ตรงจาก browser — ส่ง RAG key ไม่ได้และใครก็ยิง worker ได้
// หน้าเคสอยู่ใน "จัดการคดี" ซึ่งเป็นสิทธิ์ Pro/บริษัท
// (หน้าค้นหากฎหมายเดิมย้ายไปเป็น "ผู้ช่วย AI งานคดี" — /api/lawyer-ai/chat)
export async function researchLawDocuments(query: string) {
    const { uid } = await requireLawyerFeature('caseManagement');
    if (!(await limitUserAction('ai-law-research', uid)).success) {
        throw new Error('Rate limit exceeded. Please wait a moment.');
    }
    if (!query || query.trim() === '' || query.length > 2000) return [];
    return retrieveDocuments(query.trim());
}
