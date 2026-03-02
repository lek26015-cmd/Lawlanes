'use server';

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export interface TranslationResult {
    english: string;
    chinese: string;
}

export async function translateToMultipleLanguages(
    thaiText: string
): Promise<TranslationResult> {
    if (!thaiText || thaiText.trim().length === 0) {
        return { english: '', chinese: '' };
    }

    try {
        const prompt = `You are a professional translator. Translate the following Thai text to English and Chinese (Simplified).

Input Text:
${thaiText}

Instructions:
1. Translate to English.
2. Translate to Chinese (Simplified).
3. Return ONLY a valid JSON object. Do not include markdown formatting (like \`\`\`json).
4. JSON Format: {"english": "...", "chinese": "..."}
`;

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
        if (!apiKey) throw new Error("API Key not found");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0.3,
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        english: { type: SchemaType.STRING },
                        chinese: { type: SchemaType.STRING }
                    },
                    required: ["english", "chinese"]
                }
            }
        });

        const response = await model.generateContent(prompt);
        const text = response.response.text().trim();
        console.log('AI Response:', text); // Debugging

        try {
            const result = JSON.parse(text);

            return {
                english: result.english || '',
                chinese: result.chinese || '',
            };
        } catch (parseError) {
            console.error('Failed to parse translation response:', text, parseError);
            return { english: '', chinese: '' };
        }
    } catch (error) {
        console.error('Translation error:', error);
        throw new Error('Translation failed');
    }
}
