import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const TranslateSchema = z.object({
    title: z.string(),
    description: z.string(),
    content: z.string(),
    targetLanguage: z.enum(['en', 'zh']),
});


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title, description, content, targetLanguage } = TranslateSchema.parse(body);

        const languageName = targetLanguage === 'en' ? 'English' : 'Chinese (Simplified)';

        const prompt = `
      You are a professional legal translator. Translate the following article content from Thai to ${languageName}.
      Maintain the professional tone and legal accuracy.
      
      Input:
      Title: ${title}
      Description: ${description}
      Content: ${content}

      Output strict JSON format matching:
      {
        "title": "Translated Title",
        "description": "Translated Description",
        "content": "Translated Content (keep HTML/Markdown formatting if present)"
      }
    `;

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
        if (!apiKey) throw new Error("API Key not found");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const result = await model.generateContent(prompt);
        return NextResponse.json(JSON.parse(result.response.text()));

    } catch (error) {
        console.error('Translation error:', error);
        return NextResponse.json({ error: 'Failed to translate' }, { status: 500 });
    }
}
