'use server';
/**
 * @fileOverview An AI flow to find lawyer specialties based on a user's problem description.
 */

import { z } from 'zod';
import { getAllLawyers } from '@/lib/data';
import { Firestore, getFirestore } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getCachedAIResponse, setCachedAIResponse } from '@/lib/ai-cache';

const FindLawyersInputSchema = z.object({
  problem: z.string().describe("The user's description of their legal problem."),
});

const FindLawyersOutputSchema = z.object({
  specialties: z.array(z.string()).describe('A list of lawyer specialties relevant to the problem.'),
});

export type FindLawyersInput = z.infer<typeof FindLawyersInputSchema>;
export type FindLawyersOutput = z.infer<typeof FindLawyersOutputSchema>;

// This function now dynamically fetches specialties from Firestore
async function getDynamicLawyerSpecialties(db: Firestore): Promise<string[]> {
  const lawyers = await getAllLawyers(db);
  const allSpecialties = lawyers.flatMap(lawyer => lawyer.specialty);
  // Return unique specialties
  return [...new Set(allSpecialties)];
}

// Heuristic keyword mapping for common Thai legal problems
function getHeuristicSpecialties(problem: string, availableSpecialties: string[]): string[] {
  const p = problem.toLowerCase();
  const matches: string[] = [];
  
  const keywordMap: Record<string, string[]> = {
    'ครอบครัว': ['หย่า', 'ชู้', 'บุตร', 'รับรองบุตร', 'แบ่งสินสมรส', 'ครอบครัว', 'ฟ้องหย่า'],
    'อาญา': ['ตำรวจ', 'คุก', 'จำคุก', 'คดีอาญา', 'สถานีตำรวจ', 'หมายเรียก', 'ประกันตัว', 'ทำร้ายร่างกาย', 'ลักทรัพย์', 'ฉ้อโกง', 'ยักยอก', 'หมิ่นประมาท'],
    'ที่ดิน': ['ที่ดิน', 'โอนที่ดิน', 'รังวัด', 'ไล่ที่', 'ภาระจำยอม', 'ทางจำเป็น', 'กรรมสิทธิ์', 'น.ส.3', 'โฉนด'],
    'มรดก': ['มรดก', 'พินัยกรรม', 'ผู้จัดการมรดก', 'แบ่งมรดก', 'พินัยกรรมฝ่ายเมือง'],
    'แรงงาน': ['เลิกจ้าง', 'ค่าชดเชย', 'ประกันสังคม', 'แรงงาน', 'นายจ้าง', 'ลูกจ้าง', 'โอที', 'ค่าล่วงเวลา', 'ฟ้องแรงงาน'],
    'ธุรกิจ': ['บริษัท', 'จดทะเบียน', 'กรรมการ', 'ผู้ถือหุ้น', 'หุ้นส่วน', 'SME', 'ห้างหุ้นส่วน'],
    'สัญญา': ['ผิดสัญญา', 'เบี้ยปรับ', 'กู้ยืม', 'ค้ำประกัน', 'จำนอง', 'จำนำ', 'เช่าซื้อ', 'สัญญากู้'],
    'อุบัติเหตุ': ['รถชน', 'ประกันภัย', 'ค่าสินไหม', 'เฉี่ยวชน', 'พ.ร.บ. รถยนต์'],
    'ผู้บริโภค': ['โดนโกง', 'สินค้าไม่ตรงปก', 'คืนเงิน', 'สคบ.', 'หลอกขาย'],
  };

  for (const [specialty, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(kw => p.includes(kw))) {
      // Find the actual specialty name from dynamic list that matches or contains the category
      const actualSpecialty = availableSpecialties.find(as => as.includes(specialty));
      if (actualSpecialty) matches.push(actualSpecialty);
    }
  }

  // Limit to top 2 as per AI instructions
  return [...new Set(matches)].slice(0, 2);
}

export async function findLawyerSpecialties(input: FindLawyersInput): Promise<FindLawyersOutput> {
  const { firestore } = initializeFirebase();
  if (!firestore) throw new Error("Firestore not initialized");
  const dynamicSpecialties = await getDynamicLawyerSpecialties(firestore);

  // 1. Heuristic matching (Free & Instant)
  const heuristicMatches = getHeuristicSpecialties(input.problem, dynamicSpecialties);
  if (heuristicMatches.length > 0) {
    console.log(`[Heuristic Match] Found: ${heuristicMatches.join(', ')}`);
    return { specialties: heuristicMatches };
  }

  // 2. Try to get from cache first
  const cached = await getCachedAIResponse<FindLawyersOutput>(input.problem, 'find-lawyers');
  if (cached) return cached;

  const prompt = `You are an expert legal AI assistant for Lawslane (Thailand).
Your task is to analyze the user's legal problem and identify the most relevant lawyer specialties from the provided list.

Instructions:
1.  **Analyze the Core Issue**: Read the user's problem carefully to understand the specific legal domain (e.g., Family, Criminal, Corporate, Property).
2.  **Match Precisely**: Select ONLY the specialties that directly address the core issue. Do not select loosely related specialties.
3.  **Limit Selection**: Return at most 2 specialties, prioritizing the most critical one.
4.  **Language**: The input will be in Thai. Ensure you understand Thai legal context.

Available Specialties:
${dynamicSpecialties.map(s => `- ${s}`).join('\n')}

User's Problem: ${input.problem}
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

  const promptWithJson = prompt + '\nReturn ONLY a valid JSON object matching this schema: { "specialties": ["..."] }';

  const result = await model.generateContent(promptWithJson);
  const finalResult = JSON.parse(result.response.text()) as FindLawyersOutput;

  // Save to cache
  await setCachedAIResponse(input.problem, 'find-lawyers', finalResult);

  return finalResult;
}
