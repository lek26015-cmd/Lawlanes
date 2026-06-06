import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API Key missing' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            employer: { type: SchemaType.STRING, description: "ชื่อผู้จ้าง หรือคู่สัญญาฝ่ายที่ 1" },
            task: { type: SchemaType.STRING, description: "รายละเอียดงานหรือสรุปของสัญญา" },
            price: { type: SchemaType.NUMBER, description: "ราคาหรือมูลค่าสัญญา (ตัวเลขเท่านั้น)" },
            deposit: { type: SchemaType.NUMBER, description: "เงินมัดจำ (ถ้ามี, ตัวเลขเท่านั้น)" },
            deadline: { type: SchemaType.STRING, description: "กำหนดส่งงาน หรือวันสิ้นสุดสัญญา" },
            missingInfo: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING },
              description: "ข้อมูลสำคัญที่ดูเหมือนจะขาดไปจากเอกสาร"
            },
            riskyTerms: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING },
              description: "ข้อความที่ดูเสียเปรียบหรือมีความเสี่ยงทางกฎหมาย"
            },
          },
          required: ["employer", "task", "price", "deposit", "deadline", "missingInfo", "riskyTerms"]
        }
      }
    });

    // Extract base64 energy
    const base64Data = image.split(',')[1] || image;
    const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';

    const prompt = `You are a Legal Assistant. Analyze the provided image of a document or contract. 
    If it's a contract, agreement, or receipt, extract the details accurately.
    If it's NOT a legal document, try to describe what it is in the 'task' field and leave other fields empty/zero.
    Always provide the extracted information in Thai.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      }
    ]);

    const response = JSON.parse(result.response.text());
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[VisionAPI] Error:', error);
    return NextResponse.json({ error: 'Internal server error while processing image' }, { status: 500 });
  }
}
