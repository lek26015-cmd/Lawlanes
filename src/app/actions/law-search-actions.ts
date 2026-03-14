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
            // Only repair if it looks corrupted (contains boxes or look weird)
            if (res.content.includes('') || res.content.includes('่') === false && res.content.length > 100) {
                try {
                    const prompt = `ข้อความต่อไปนี้มีปัญหาเรื่องการแสดงผลภาษาไทย (สระ/วรรณยุกต์ เป็นสี่เหลี่ยม หรือเพี้ยนจากการสกัด PDF) 
จงซ่อมแซมและพิมพ์ออกมาใหม่อ่านให้ได้ใจความสมบูรณ์เป็นภาษาไทยที่ถูกต้อง โดยห้ามสรุป ให้คงเนื้อหาเดิมไว้ทุกประการ:

---
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
