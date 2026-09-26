'use server';

import { retrieveDocuments, retrieveExpanded, resolveLawTitles } from '@/lib/rag';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getCachedAIResponse, setCachedAIResponse } from '@/lib/ai-cache';
import { requireUser, requireLawyer } from '@/lib/auth-guard';
import { limitUserAction } from '@/lib/security/action-rate-limit';

export type SearchResult = {
    source: string;
    content: string;
    score: number;
    /** ชื่อกฎหมายที่อ่านได้ เช่น "ประมวลกฎหมายที่ดิน" (ถ้าหาได้) */
    title?: string;
    year?: number;
};

// ค้นเอกสารกฎหมายดิบ (ไม่ผ่าน LLM) สำหรับเครื่องมือค้นคว้าในหน้าเคสของทนาย
// เดิม component เรียก retrieveDocuments ตรงจาก browser — ส่ง RAG key ไม่ได้และใครก็ยิง worker ได้
export async function researchLawDocuments(query: string) {
    const { uid } = await requireLawyer();
    if (!(await limitUserAction('ai-law-research', uid)).success) {
        throw new Error('Rate limit exceeded. Please wait a moment.');
    }
    if (!query || query.trim() === '' || query.length > 2000) return [];
    return retrieveDocuments(query.trim());
}

export async function searchLaws(query: string, limit: number = 10): Promise<SearchResult[]> {
    // endpoint นี้เรียก LLM ซึ่งมีค่าใช้จ่ายต่อครั้ง — ต้องล็อกอินอยู่จริง
    const { uid } = await requireUser();
    if (!(await limitUserAction('ai-law-search', uid)).success) {
        throw new Error('Rate limit exceeded. Please wait a moment.');
    }

    if (!query || query.trim() === '') return [];

    try {
        // ผู้ใช้พิมพ์ภาษาชาวบ้าน แต่ฐานข้อมูลเป็นภาษาตัวบท — แปลงเป็นคำค้นแบบตัวบทแล้วค้นหลายรอบ
        const results = await retrieveExpanded(query.trim(), limit);

        const top = results.slice(0, 8);
        if (top.length === 0) return [];

        const titles = await resolveLawTitles(top.map(r => r.source));
        const filteredResults: SearchResult[] = top.map(r => ({ ...r, title: titles.get(r.source) }));

        // AI Text Repair: Fix corrupted Thai characters (boxes/encoding issues from PDF)
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
        if (!apiKey) return filteredResults; // Fallback if no key

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const repairedResults = await Promise.all(filteredResults.map(async (res) => {
            // Detection: Check for common "box" chars (tofu) or lack of Thai tone marks/vowels in long text
            const hasTofu = /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(res.content) || res.content.includes('□');
            const lacksTones = !/[่้๊๋ะาิีึืุูเแโใไํั]/.test(res.content); // If a long Thai string has NO vowels/tones, it's likely broken
            
            if (hasTofu || (lacksTones && res.content.length > 50)) {
                console.log(`[AI Repair] Triggering check for: ${res.source} (Reason: ${hasTofu ? 'Tofu detected' : 'Lacks Thai vowels'})`);
                
                // Deterministic Repair (Fast Path)
                let cleanedContent = res.content
                    .replace(/([ก-ฮ])\s+([่้๊๋ะาิีึืุูัํ])/g, '$1$2')
                    .replace(/([่้๊๋ะาิีึืุูัํ])\s+([ก-ฮ])/g, '$1$2')
                    .replace(/พจารณา/g, 'พิจารณา')
                    .replace(/บญญต/g, 'บัญญัติ')
                    .replace(/มาตรา\s+(\d+)/g, 'มาตรา $1')
                    .replace(/[ ]{2,}/g, ' ')
                    .trim();

                // Re-check quality after deterministic fix
                const stillHasTofu = /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(cleanedContent) || cleanedContent.includes('□');
                const stillLacksTones = !/[่้๊๋ะาิีึืุูเแโใไํั]/.test(cleanedContent);

                if (!stillHasTofu && (!stillLacksTones || cleanedContent.length <= 50)) {
                    console.log(`[Deterministic Repair] Fixed: ${res.source}`);
                    return { ...res, content: cleanedContent };
                }

                // Try to get from cache first
                const cached = await getCachedAIResponse<string>(res.content, 'law-repair');
                if (cached) return { ...res, content: cached };

                try {
                    const prompt = `ข้อความต่อไปนี้สกัดมาจาก PDF และมีปัญหาเรื่องตัวอักษรกลายเป็นกล่อง สระหาย หรือวรรณยุกต์เพี้ยน (เช่น "พจารณา" แทน "พิจารณา")
จง "แก้ไขและพิมพ์ข้อความใหม่" ให้เป็นภาษาไทยที่สมบูรณ์ อ่านรู้เรื่อง ตามหลักกฎหมาย โดยคงความหมายเดิมไว้ทุกประการ ห้ามสรุปความ:

--- ข้อความที่เสียหาย ---
${res.content}
---`;
                    const repairResult = await model.generateContent(prompt);
                    const fixedText = repairResult.response.text().trim();
                    
                    // Save to cache
                    await setCachedAIResponse(res.content, 'law-repair', fixedText);

                    return { ...res, content: fixedText };
                } catch (e) {
                    console.error("Failed to repair text for", res.source, e);
                    return res;
                }
            }
            return res;
        }));

        return repairedResults;
    } catch (error) {
        console.error('[Semantic Search] Error fetching laws:', error);
        return [];
    }
}
