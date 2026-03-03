import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Define the schema using Zod
const RequestSchema = z.object({
    images: z.array(z.string()).optional(),
    image: z.string().optional(), // Backwards compatibility
    locale: z.string().optional(),
});


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { images, image, locale = 'th' } = RequestSchema.parse(body);

        const imageList = images || (image ? [image] : []);

        if (imageList.length === 0) {
            return NextResponse.json({ error: 'Image is required' }, { status: 400 });
        }

        const language = locale === 'en' ? 'English' : 'Thai';

        const prompt = `
      You are a legal AI assistant. Analyze the screenshot(s) of a chat conversation between a craftsman/freelancer and a customer.
      Extract the following information to draft a simple agreement.
      
      IMPORTANT: You must output all values in the ${language} language. translate if necessary.
      
      CRITICAL RULES FOR EMPTY FIELDS:
      - If you cannot find a piece of information, return an EMPTY STRING (""), NOT a placeholder like "ไม่ระบุ" or "ไม่ระบุชื่อ" or "N/A"
      - NEVER include labels like "ผู้ว่าจ้าง" or "ผู้รับจ้าง" in the values - only return actual names
      - If you see a nickname like "J.s" or "ลุง", just use that as the name, don't add labels
      - For employer and contractor fields: return the actual name found, or empty string if not clearly identifiable
      
      CRITICAL CONTEXT FOR IDENTIFYING PARTIES:
      - In chat screenshots, there are typically two sides of the conversation
      - The person who ASKS someone to do work (จ้าง) = EMPLOYER (ผู้ว่าจ้าง) - They pay money
      - The person who is ASKED to do work or ACCEPTS a job = CONTRACTOR (ผู้รับจ้าง) - They receive money and do the work
      - Look for context clues like "ผมอยากจ้างลุง..." (I want to hire uncle) - the speaker is the employer
      - If one person is offering to do a service, they are the CONTRACTOR
      - If one person is requesting a service to be done for them, they are the EMPLOYER
      - The chat contact name shown at the top (e.g. "J.s") typically indicates who the employer is chatting WITH (likely the contractor)
      
      - Employer: The actual name/nickname of the person who is HIRING/PAYING. Return ONLY the name, no labels.
      - Contractor: The actual name/nickname of the person doing the work. Return ONLY the name, no labels.
      - Task: What work needs to be done.
      - Price: The total cost. Return 0 if not found.
      - Deposit: Any deposit mentioned. Return 0 if not found.
      - Deadline: When the work should be finished. Calculate the specific date if relative terms like "next Friday" are used. Assume today is ${new Date().toLocaleDateString()}.
      - Payment Terms: When the rest should be paid. Return empty string if not found.
      - Missing Info: Identify any critical legal terms missing in ${language}.
      - Risky Terms: Identify any vague or dangerous promises in ${language}.
      
      Output strictly in JSON format matching this schema:
      {
        "employer": "string",
        "contractor": "string",
        "task": "string",
        "price": number,
        "deposit": number,
        "deadline": "string",
        "paymentTerms": "string",
        "missingInfo": ["string"],
        "riskyTerms": ["string"]
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

        const imageParts = imageList.map(img => {
            let mimeType = 'image/jpeg';
            let data = img;
            if (img.startsWith('data:')) {
                const matches = img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
                if (matches && matches[1] && matches[2]) {
                    mimeType = matches[1];
                    data = matches[2];
                }
            }
            return {
                inlineData: {
                    data,
                    mimeType
                }
            };
        });

        const result = await model.generateContent([prompt, ...imageParts]);

        if (!result || !result.response) {
            throw new Error('Failed to generate contract draft');
        }

        const jsonString = result.response.text();
        return NextResponse.json(JSON.parse(jsonString));

    } catch (error: any) {
        console.error('Contract draft generation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process image' },
            { status: 500 }
        );
    }
}
