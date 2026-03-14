'use server';

import { retrieveDocuments } from '@/lib/rag';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type SearchResult = {
    source: string;
    content: string;
    score: number;
};

export async function searchLaws(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!query || query.trim() === '') return [];

    try {
        const results = await retrieveDocuments(query, limit);
        
        const filteredResults = results
            .filter(r => r.score > 0.45) // Slightly lower threshold to capture more, then we clean
            .sort((a, b) => b.score - a.score)
            .slice(0, 5); // Limit to top 5 for AI repair to keep it fast

        if (filteredResults.length === 0) return [];

        // AI Text Repair: Fix corrupted Thai characters (boxes/encoding issues from PDF)
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
        if (!apiKey) return filteredResults; // Fallback if no key

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const repairedResults = await Promise.all(filteredResults.map(async (res) => {
            // Detection: Check for common "box" chars (tofu) or lack of Thai tone marks/vowels in long text
            const hasTofu = /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(res.content) || res.content.includes('□');
            const lacksTones = !/[่้๊๋ะาิีึืุูเแโใไํั]/.test(res.content); // If a long Thai string has NO vowels/tones, it's likely broken
            
            if (hasTofu || (lacksTones && res.content.length > 50)) {
                console.log(`[AI Repair] Triggering for: ${res.source} (Reason: ${hasTofu ? 'Tofu detected' : 'Lacks Thai vowels'})`);
                try {
                    const prompt = `ข้อความต่อไปนี้สกัดมาจาก PDF และมีปัญหาเรื่องตัวอักษรกลายเป็นกล่อง สระหาย หรือวรรณยุกต์เพี้ยน (เช่น "พจารณา" แทน "พิจารณา")
จง "แก้ไขและพิมพ์ข้อความใหม่" ให้เป็นภาษาไทยที่สมบูรณ์ อ่านรู้เรื่อง ตามหลักกฎหมาย โดยคงความหมายเดิมไว้ทุกประการ ห้ามสรุปความ:

--- ข้อความที่เสียหาย ---
${res.content}
---`;
                    const repairResult = await model.generateContent(prompt);
                    const fixedText = repairResult.response.text().trim();
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
