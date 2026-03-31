'use server';

import { retrieveDocuments } from '@/lib/rag';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getCachedAIResponse, setCachedAIResponse } from '@/lib/ai-cache';

export type ContractAnalysisResult = {
    summary: string;
    keywords: string[];
    observations: {
        issue: string;
        explanation: string;
        severity: 'low' | 'medium' | 'high';
        citedLaw?: string;
    }[];
};

export async function analyzeContract(contractText: string): Promise<ContractAnalysisResult> {
    if (!contractText || contractText.trim() === '') {
        throw new Error("Contract text is empty");
    }

    // Try to get from cache first
    const cached = await getCachedAIResponse<ContractAnalysisResult>(contractText, 'contract-analysis');
    if (cached) return cached;

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    if (!apiKey) {
        throw new Error("API Key not found");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const extractionModel = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    keywords: {
                        type: SchemaType.ARRAY,
                        description: "3-5 very specific Thai legal keywords to search in a legal database (e.g. 'จ้างแรงงาน', 'เบี้ยปรับ', 'ข้อสัญญาที่ไม่เป็นธรรม').",
                        items: { type: SchemaType.STRING }
                    }
                },
                required: ["keywords"]
            }
        }
    });

    // Step 1: Extract Keywords
    const extractionPrompt = `วิเคราะห์ข้อความสัญญาต่อไปนี้ และสกัดคำสำคัญทางกฎหมาย (Keywords) ออกมา 3-5 คำ เพื่อนำไปค้นหาในฐานข้อมูลกฎหมายไทย:\n\n${contractText.substring(0, 3000)}`;
    
    let keywords: string[] = [];
    try {
        const keywordResult = await extractionModel.generateContent(extractionPrompt);
        const keywordData = JSON.parse(keywordResult.response.text());
        keywords = keywordData.keywords || [];
    } catch (e) {
        console.error("Failed to extract keywords", e);
        keywords = ["สัญญา", "ข้อตกลง", "ความรับผิด"]; // fallback
    }

    // Step 2: Fetch Laws via RAG
    let combinedLawContext = "";
    if (keywords.length > 0) {
        const searchQuery = keywords.join(" ");
        const ragDocs = await retrieveDocuments(searchQuery, 8); // Get top 8 relevant chunks
        
        // Filter good matches and combine text
        const filteredDocs = ragDocs.filter(doc => doc.score > 0.5);
        if (filteredDocs.length > 0) {
            combinedLawContext = filteredDocs.map(doc => `[จากเอกสาร: ${doc.source}]\n${doc.content}`).join("\n\n---\n\n");
        } else {
             combinedLawContext = "ไม่พบข้อกฎหมายที่เกี่ยวข้องโดยตรงในฐานข้อมูล (ให้วิเคราะห์จากหลักกฎหมายทั่วไป)";
        }
    }

    // Step 3: Analyze Contract against Laws
    const analysisModel = genAI.getGenerativeModel({
        model: "gemini-1.5-flash", // Optimized: Using Flash with better prompting for cost efficiency
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    summary: {
                        type: SchemaType.STRING,
                        description: "สรุปภาพรวมของสัญญานี้สั้นๆ ว่าเป็นสัญญาเกี่ยวกับอะไร มีจุดประสงค์หลักคืออะไร"
                    },
                    observations: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                issue: { type: SchemaType.STRING, description: "หัวข้อประเด็นที่พบ (เช่น 'เบี้ยปรับสูงเกินควร', 'การยกเว้นความรับผิด')" },
                                explanation: { type: SchemaType.STRING, description: "อธิบายว่าทำไมถึงเป็นประเด็น อาจจะเอาเปรียบ หรือขัดต่อกฎหมาย หรือควรระวังอย่างไร" },
                                severity: { type: SchemaType.STRING, description: "ระดับความรุนแรง/ความเสี่ยง: 'low', 'medium', 'high'" },
                                citedLaw: { type: SchemaType.STRING, description: "กฎหมายที่เกี่ยวข้องที่ใช้อ้างอิง (อ้างอิงจาก Context ที่ให้ไป ถ้ายกมาตรามาได้จะดีมาก)" }
                            },
                            required: ["issue", "explanation", "severity"]
                        }
                    }
                },
                required: ["summary", "observations"]
            }
        }
    });

    const analysisPrompt = `
คุณคือผู้เชี่ยวชาญด้านกฎหมายและทนายความของไทย (AI Legal Auditor) มีหน้าที่ตรวจสอบและวิเคราะห์ข้อความสัญญา(หรือเงื่อนไข)ที่ผู้ใช้ให้มาอย่างละเอียดถี่ถ้วน
จงวิเคราะห์สัญญาโดยพิจารณาจาก "ข้อกฎหมายอ้างอิง (Context)" ที่สืบค้นมาให้ด้านล่างนี้เป็นหลัก หาก context ไม่ระบุ ให้ใช้ความรู้กฎหมายไทยพื้นฐานที่เข้มงวด (เช่น ป.พ.พ., พ.ร.บ. ว่าด้วยข้อสัญญาที่ไม่เป็นธรรม)

คำแนะนำเพิ่มเติมสำหรับ AI:
1. พิจารณาความเป็นส่วนตัวและความรัดกุมของข้อสัญญา
2. มองหาช่องโหว่ที่อาจทำให้ผู้ใช้เสียเปรียบ
3. หากมีตัวเลข (เช่น เบี้ยปรับ, ระยะเวลา) ให้ตรวจสอบความสมเหตุสมผลตามกฎหมาย

--- ข้อกฎหมายอ้างอิง (Context) ---
${combinedLawContext}
----------------------------------

--- ข้อความสัญญาที่ต้องตรวจสอบ ---
${contractText}
----------------------------------

วิเคราะห์และตอบกลับในรูปแบบ JSON ตาม Schema ที่กำหนดให้เท่านั้น ห้ามมีคำเกริ่น:
- สรุปภาพรวม (summary): สรุปสาระสำคัญของสัญญาใน 2-3 ประโยค
- จุดสังเกต/ความเสี่ยง (observations): สกัดประเด็นที่คนทั่วไปอาจมองข้าม ระบุความรุนแรงตามจริง (high หากขัดกฎหมายชัดเจน) และระบุมาตรากฎหมายอ้างอิงใน citedLaw ให้ชัดเจนที่สุด
    `;

    try {
        const analysisResult = await analysisModel.generateContent(analysisPrompt);
        const data = JSON.parse(analysisResult.response.text());
        
        const finalResult = {
            summary: data.summary,
            keywords: keywords,
            observations: data.observations || []
        };

        // Save to cache
        await setCachedAIResponse(contractText, 'contract-analysis', finalResult);

        return finalResult;
    } catch (e: any) {
        console.error("Analysis failed", e);
        throw new Error("Failed to analyze contract: " + e.message);
    }
}
