'use server';

import { ai } from '@/ai/genkit';
import { retrieveContext } from '@/lib/rag';
import { z } from 'zod';

const LegalQaInputSchema = z.object({
    question: z.string(),
});

export async function generateLegalAdvice(question: string) {
    try {
        // Retrieve relevant context using RAG
        const context = await retrieveContext(question);

        if (!context || context.trim() === '') {
            return "ระบบยังไม่พบฐานข้อมูลเอกสาร (PDFs) หรือกำลังสร้างดัชนีข้อมูล กรุณาลองใหม่อีกครั้งในอีกสักครู่";
        }

        const prompt = `
      คุณคือผู้ช่วยทนายความอัจฉริยะ (AI Legal Advisor) ของ Lawlanes
      หน้าที่ของคุณคือการตอบคำถามทางกฎหมายโดยอ้างอิงจากข้อมูลในเอกสารที่แนบมานี้เท่านั้น
      
      --- ข้อมูลอ้างอิง (Context) ---
      ${context}
      ------------------------------
      
      คำถาม: ${question}
      
      คำแนะนำในการตอบ:
      1. ตอบคำถามโดยใช้ข้อมูลจาก "ข้อมูลอ้างอิง" เท่านั้น
      2. หากข้อมูลใน "ข้อมูลอ้างอิง" ไม่เพียงพอที่จะตอบคำถาม ให้แจ้งผู้ใช้ว่า "ขออภัย ข้อมูลในเอกสารไม่เพียงพอที่จะตอบคำถามนี้"
      3. อ้างอิงชื่อเอกสารหรือมาตราที่เกี่ยวข้องหากมีในข้อมูล
      4. ใช้ภาษาที่เป็นทางการ สุภาพ และเข้าใจง่าย
      5. หากเป็นคำแนะนำทางกฎหมาย ให้ระบุเสมอว่าเป็น "คำแนะนำเบื้องต้น" และควรปรึกษาทนายความเพื่อความถูกต้อง
    `;

        const { text } = await ai.generate(prompt);
        return text;

    } catch (error) {
        console.error('Error generating legal advice:', error);
        return "ขออภัย เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง";
    }
}
