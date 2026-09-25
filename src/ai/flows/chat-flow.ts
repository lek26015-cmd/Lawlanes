'use server';

import { limitPublicAction } from '@/lib/security/action-rate-limit';
/**
 * @fileOverview A simple chat flow that uses the Gemini model with RAG.
 */

import { z } from 'zod';
import { initializeFirebase } from '@/firebase';
import { retrieveDocuments, resolveLawTitles } from '@/lib/rag';
import { callTyphoonAI } from '@/lib/typhoon';
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType as GenAISchemaType, Content } from '@google/generative-ai';
import { collection, getDocs, limit, query } from 'firebase/firestore';

const searchArticlesDeclaration: FunctionDeclaration = {
  name: "searchArticles",
  description: "Search for authoritative legal documents, Ratchakitcha (Royal Gazette), and Krisdika laws from the Lawslane database.",
  parameters: {
    type: GenAISchemaType.OBJECT,
    properties: {
      query: {
        type: GenAISchemaType.STRING,
        description: "The Thai legal keyword or scenario to search for in laws and documents.",
      },
    },
    required: ["query"],
  },
};

function formatSourceTitle(source: string): string {
  if (!source) return 'ข้อมูลกฎหมาย';
  
  const src = source.toLowerCase();
  // Map directory patterns to official Thai source names
  if (src.includes('ราชกิจจานุเบกษา') || src.includes('ratchakitcha')) return 'ที่มา: ราชกิจจานุเบกษา';
  if (src.includes('กฤษฎีกา') || src.includes('krisdika')) return 'ที่มา: สำนักงานคณะกรรมการกฤษฎีกา';
  if (src.includes('ประมวลกฎหมาย')) return `ที่มา: ${source}`;
  
  // Default fallback cleaning
  const filename = source.split('/').pop() || source;
  const cleanName = filename.replace(/\.(json|pdf)$/i, '');
  
  // If it's a number (common in these datasets), try to give it context
  if (/^\d+$/.test(cleanName)) {
    return `เอกสารราชการ เลขที่ ${cleanName}`;
  }
  
  return `ที่มา: ${cleanName}`;
}

/**
 * แยกว่าข้อความของผู้ใช้เป็น "คำถามกฎหมาย" หรือแค่ "ทักทาย/คุยเล่น"
 *
 * ออกแบบให้ปลอดภัยไว้ก่อน (fail-safe): ถ้าไม่มั่นใจ จะถือว่าเป็นคำถามกฎหมายเสมอ
 * เพราะการพลาดค้นกฎหมายให้ผู้ใช้ เสียหายกว่าการค้นเกินความจำเป็น
 */
const LEGAL_KEYWORDS = [
  // ไทย
  'กฎหมาย', 'มาตรา', 'พ.ร.บ', 'พรบ', 'ประมวล', 'คดี', 'ฟ้อง', 'ศาล', 'ทนาย', 'อัยการ',
  'สัญญา', 'นิติกรรม', 'หย่า', 'สมรส', 'สินสมรส', 'มรดก', 'พินัยกรรม', 'ทายาท',
  'สิทธิ', 'หน้าที่', 'ละเมิด', 'หนี้', 'ลูกหนี้', 'เจ้าหนี้', 'ค้ำประกัน', 'จำนอง', 'จำนำ',
  'ค่าเสียหาย', 'ชดเชย', 'ค่าปรับ', 'จำคุก', 'โทษ', 'ผิดกฎหมาย', 'อาญา', 'แพ่ง',
  'แรงงาน', 'ลูกจ้าง', 'นายจ้าง', 'เลิกจ้าง', 'ลาคลอด', 'ประกันสังคม',
  'ที่ดิน', 'โฉนด', 'เช่า', 'ภาษี', 'ใบกำกับ', 'บริษัท', 'หุ้นส่วน', 'ล้มละลาย',
  'ประกันภัย', 'ผู้บริโภค', 'ลิขสิทธิ์', 'เครื่องหมายการค้า', 'สิทธิบัตร',
  'หมิ่นประมาท', 'ฉ้อโกง', 'ลักทรัพย์', 'ยักยอก', 'อายุความ', 'แจ้งความ', 'ร้องเรียน',
  // อังกฤษ
  'law', 'legal', 'lawyer', 'attorney', 'court', 'sue', 'lawsuit', 'contract',
  'divorce', 'inherit', 'estate', 'liability', 'damages', 'compensation',
  'criminal', 'civil', 'tax', 'labor', 'labour', 'employment', 'copyright', 'patent',
  // จีน
  '法律', '律师', '法院', '起诉', '合同', '离婚', '继承', '赔偿', '刑事', '民事', '劳动', '税',
];

const SMALLTALK_PATTERNS: RegExp[] = [
  // ทักทาย
  /^(สวัสดี|หวัดดี|วัสดี|ฮัลโหล|ฮาโหล|หวัดดีจ้า)/,
  /^(hello|hi|hey|good\s*(morning|afternoon|evening))\b/,
  /^(你好|您好|哈囉|哈罗)/,
  // ขอบคุณ / ลา
  /^(ขอบคุณ|ขอบใจ|ขอบพระคุณ)/,
  /^(thanks|thank\s*you|ty)\b/,
  /^(谢谢|多谢)/,
  /^(ลาก่อน|บ๊ายบาย|บายๆ|บาย)$/,
  /^(bye|goodbye|see\s*you)\b/,
  /^(再见|拜拜)/,
  // ถามตัวตน / ความสามารถ
  /^(คุณ|เธอ|น้อง)?\s*(คือใคร|ชื่ออะไร|เป็นใคร)/,
  /(ทำอะไรได้บ้าง|ช่วยอะไรได้บ้าง|มีความสามารถอะไร)/,
  /^(who\s*are\s*you|what\s*(can|do)\s*you\s*do)/,
  /^(你是谁|你能做什么)/,
  // ชมเชย
  /^(เก่งมาก|เก่งจัง|ดีมาก|สุดยอด|เยี่ยม)/,
  /^(great|nice|awesome|cool|well\s*done)\b/,
];

// ข้อความตอบรับสั้นๆ ที่ต้องตรงทั้งประโยคเท่านั้น (กันไปชนคำถามที่ลงท้ายด้วย ครับ/ค่ะ)
const ACK_EXACT = new Set([
  'ครับ', 'ค่ะ', 'คะ', 'จ้า', 'จ้าา', 'จ๊ะ', 'ได้', 'ได้ครับ', 'ได้ค่ะ',
  'โอเค', 'โอเคครับ', 'โอเคค่ะ', 'เข้าใจแล้ว', 'เข้าใจแล้วครับ', 'เข้าใจแล้วค่ะ',
  'อ๋อ', 'อืม', 'อืมม', 'ok', 'okay', 'k', 'yes', 'no', 'yep', 'nope',
  '好', '好的', '嗯', '明白',
]);

type ChatIntent = 'legal' | 'smalltalk';

// เดิม export ไว้แต่ไม่มีที่ไหนใน src/ import ไปใช้ — และไฟล์นี้มี 'use server' ที่บนสุด
// ซึ่ง Next.js บังคับว่าทุก export ต้องเป็น async function เท่านั้น ฟังก์ชัน sync ล้วนนี้
// ทำให้ `next build` พังทั้งโปรเจกต์ (ตรวจพบตอนรัน build เพื่อยืนยันงานอื่นในรอบนี้)
function detectIntent(rawPrompt: string): ChatIntent {
  const prompt = (rawPrompt || '').trim();
  if (!prompt) return 'smalltalk';

  const lower = prompt.toLowerCase();

  // 1. มีคำที่ส่อว่าเป็นเรื่องกฎหมาย -> ถือเป็นคำถามกฎหมายเสมอ
  //    ครอบคลุมกรณี "สวัสดีครับ อยากถามเรื่องหย่า"
  if (LEGAL_KEYWORDS.some(k => lower.includes(k))) return 'legal';

  // 2. ข้อความตอบรับสั้นๆ (ต้องตรงทั้งประโยค)
  const stripped = lower.replace(/[\s.!?ๆฯ]+$/g, '');
  if (ACK_EXACT.has(stripped)) return 'smalltalk';

  // 3. ทักทาย/คุยเล่น — จำกัดความยาว กันข้อความยาวที่ขึ้นต้นด้วยคำทักทาย
  //    แต่มีเนื้อหาคำถามจริงตามหลัง
  if (prompt.length <= 40 && SMALLTALK_PATTERNS.some(re => re.test(lower))) {
    return 'smalltalk';
  }

  // 4. ไม่มั่นใจ -> ถือว่าเป็นคำถามกฎหมาย (ปลอดภัยกว่า)
  return 'legal';
}

async function executeSearchArticles(queryStr: string) {
  console.log(`[searchArticlesTool] Searching for: ${queryStr}`);

  // 1. Search RAG (Cloudflare)
  let ragDocs: Array<{ source: string, content: string, score: number }> = [];
  try {
    const allDocs = await retrieveDocuments(queryStr);
    ragDocs = allDocs.filter(doc => doc.score > 0.5);
    console.log(`[searchArticlesTool] RAG found ${allDocs.length} docs, ${ragDocs.length} passed threshold (0.5).`);
  } catch (err) {
    console.error("RAG search failed:", err);
  }

  const results = [];

  if (ragDocs.length > 0) {
    // CAP: Limit to top 3 results for token efficiency
    ragDocs.slice(0, 3).forEach(doc => {
      const sourceTitle = formatSourceTitle(doc.source);
      results.push({
        title: sourceTitle,
        content: `[[SOURCE: ${sourceTitle}]]\nเนื้อหา: ${doc.content}\n\n[MANDATORY CITATION: ${sourceTitle}]`
      });
    });
  } else {
    console.log("[searchArticlesTool] No relevant RAG docs. Asking Typhoon...");
    const typhoonResponse = await callTyphoonAI(queryStr);
    if (typhoonResponse) {
      results.push({
        title: "ข้อมูลความรู้ทั่วไป (จาก Typhoon AI)",
        content: `[[SOURCE: Typhoon AI Knowledge]]\n${typhoonResponse}\n\n[MANDATORY CITATION: ข้อมูลความรู้ทั่วไป]`
      });
    }
  }

  return { results };
}

const ChatRequestSchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      content: z.array(z.object({ text: z.string() })),
    })
  ),
  prompt: z.string(),
  locale: z.string().optional(),
});

const ChatResponseSchema = z.object({
  sections: z.array(z.object({
    title: z.string().describe('The title of the section.'),
    content: z.string().describe('The content of the section.'),
    link: z.string().optional().describe('An optional URL for a call-to-action button.'),
    linkText: z.string().optional().describe('The text to display on the call-to-action button.'),
  })).describe('An array of sections to structure the response.'),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ผู้ใช้ไม่เห็นรายการ source ที่ส่งให้โมเดล — ถ้าโมเดลยังเขียน "(Source 2)" มา ให้ตัดทิ้ง
// (prompt สั่งให้อ้างเป็นชื่อกฎหมาย+มาตราแทนแล้ว นี่เป็นตาข่ายกันพลาด)
const SOURCE_TAG = /\s*[(\[]\s*(?:Source|แหล่งที่มา|แหล่งข้อมูล)\s*\[?\s*\d+(?:\s*[,&และ]+\s*\d+)*\s*\]?\s*[)\]]/gi;
function stripSourceTags(response: ChatResponse): ChatResponse {
  const clean = (v: unknown): unknown => {
    if (typeof v === 'string') return v.replace(SOURCE_TAG, '');
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]));
    return v;
  };
  return clean(response) as ChatResponse;
}

// คำถามของลูกความเป็นภาษาชาวบ้าน ("เพื่อนบ้านรุกล้ำที่ดิน") แต่ฐานข้อมูลเป็นภาษาตัวบท
// ("โรงเรือนที่สร้างรุกล้ำเข้าไปในที่ดินของผู้อื่น") ค้นตรง ๆ จึงได้มาตราที่ไม่เกี่ยว
// ให้ Gemini แปลงเป็นคำค้นแบบตัวบทก่อน แล้วค้นหลายรอบพร้อมกัน
async function expandLegalQueries(genAI: GoogleGenerativeAI, question: string): Promise<string[]> {
  // 2.5-flash ตอบ 503 (โหลดสูง) บ่อย — ลองรุ่นเบาต่อ ถ้าพังทั้งคู่ใช้คำถามเดิมค้นอย่างเดียว
  for (const modelName of ['gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
    const queries = await expandWith(genAI, modelName, question);
    if (queries.length > 0) return queries;
  }
  return [];
}

async function expandWith(genAI: GoogleGenerativeAI, modelName: string, question: string): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });
    const res = await Promise.race([
      model.generateContent(
        `Rewrite this Thai legal question into 3 short search queries written the way Thai statutes phrase it ` +
        `(ประมวลกฎหมายแพ่งและพาณิชย์, ประมวลกฎหมายอาญา, ประมวลกฎหมายที่ดิน, พ.ร.บ. ต่าง ๆ). ` +
        `Cover the civil, criminal and administrative angles if relevant. Do NOT include section numbers. ` +
        `Return JSON {"queries": ["...","...","..."]}.\n\nQuestion: ${question}`
      ),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    const parsed = JSON.parse(res.response.text()) as { queries?: unknown };
    return Array.isArray(parsed.queries)
      ? parsed.queries.filter((q): q is string => typeof q === 'string' && q.trim().length > 0).slice(0, 3)
      : [];
  } catch (e) {
    console.warn(`[ChatFlow] Query expansion with ${modelName} failed:`, e instanceof Error ? e.message : e);
    return [];
  }
}

export async function chat(
  request: z.infer<typeof ChatRequestSchema>
): Promise<ChatResponse> {
  const { history, prompt, locale = 'th' } = request;

  // เปิดให้คนที่ยังไม่ล็อกอินใช้ได้โดยตั้งใจ (แชทบอทหน้าแรก) แต่ทุกครั้งเผาโควตา Gemini/Typhoon
  // เดิมไม่มีด่านอะไรเลย → จำกัดความถี่ต่อ IP
  const rl = await limitPublicAction('ai-chat');
  if (!rl.success) {
    return { sections: [{ title: '', content: locale.startsWith('en') ? 'Too many requests. Please wait a moment and try again.' : 'มีการใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' }] };
  }

  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    const typhoonKey = process.env.TYPHOON_API_KEY || '';
    
    // Explicit debug logging for the environment
    console.log(`[ChatFlow] Attempting chat with Prompt: "${prompt.substring(0, 30)}..."`);

    if (!apiKey) {
      console.warn("[ChatFlow] No Google API Key found. Falling back to manual mode.");
      throw new Error("No Gemini API Key (Missing in Environment)");
    }

    let languageInstruction = "Answer in Thai.";
    if (locale.startsWith('en')) {
      languageInstruction = "Answer in English. IMPORTANT: For any specific legal terms, laws, or sensitive legal advice, you MUST provide the original Thai text alongside the English translation (e.g., 'Civil Code (ประมวลกฎหมายแพ่ง)').";
    }
    if (locale.startsWith('zh')) {
      languageInstruction = "Answer in Chinese (Simplified). IMPORTANT: For any specific legal terms, laws, or sensitive legal advice, you MUST provide the original Thai text alongside the Chinese translation.";
    }

    let finalPrompt = `${prompt}\n\n[System Instruction: ${languageInstruction}]`;

    if (history && history.length > 0) {
      finalPrompt += `\n\n[System Note: This is a continuing conversation. Do NOT introduce yourself again. Do NOT say 'Hello' or 'Sawasdee'. Answer the question directly.]`;
    }

    // แยกเจตนาก่อน: ทักทาย/คุยเล่น จะไม่ไปค้นฐานข้อมูลกฎหมาย
    const intent = detectIntent(prompt);
    console.log(`[ChatFlow] Intent = ${intent} for "${prompt.substring(0, 30)}..."`);

    if (intent === 'smalltalk') {
      finalPrompt += `\n\n[System Note: This message is a greeting or casual conversation, NOT a legal question. Do NOT cite any law and do NOT give legal information. Reply briefly and warmly in 1-2 sentences, then invite the user to ask their legal question.]`;
    }

    // Pre-fetch RAG results before sending to Gemini (legal questions only)
    let ragContext = '';
    try {
      let ragDocs: Awaited<ReturnType<typeof retrieveDocuments>> = [];
      if (intent !== 'smalltalk') {
        const expanded = await expandLegalQueries(new GoogleGenerativeAI(apiKey), prompt);
        const batches = await Promise.all([prompt, ...expanded].map(q => retrieveDocuments(q, 10)));
        ragDocs = batches.flat().sort((a, b) => b.score - a.score);
        console.log(`[ChatFlow] Queries: ${JSON.stringify([prompt, ...expanded])}`);
      }

      // ฐานข้อมูลมี chunk ซ้ำกันเยอะมาก (ชิ้นเดียวกันถูก index หลายรอบ)
      // ถ้าไม่ตัดซ้ำ โควตาเอกสารจะถูกกินหมดจนเหลือข้อมูลจริงชิ้นเดียว
      // แล้ว AI จะถูกบีบให้เดาส่วนที่เหลือ
      const seen = new Set<string>();
      const relevantDocs = ragDocs
        .filter(doc => doc.score > 0.4)
        .filter(doc => {
          const key = doc.content.replace(/\s+/g, '').slice(0, 80);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      if (relevantDocs.length > 0) {
        const topDocs = relevantDocs.slice(0, 8);
        // ชื่อกฎหมายจริงแทนชื่อไฟล์ ("ประมวลกฎหมายที่ดิน" แทน "สำนักงานคณะกรรมการกฤษฎีกา")
        // ไม่งั้นโมเดลอ้างอิงผิดกฎหมาย
        const lawTitles = await resolveLawTitles(topDocs.map(d => d.source));
        ragContext = topDocs.map((doc, i) => {
          const sourceTitle = lawTitles.get(doc.source) || formatSourceTitle(doc.source);
          // ติดปีไปด้วย เพื่อให้แยกออกว่าฉบับไหนเป็นฉบับแก้ไขล่าสุด
          const yearTag = doc.year ? ` | year ${doc.year}` : '';
          return `[Source ${i + 1}: ${sourceTitle}${yearTag}]\n${doc.content}`;
        }).join('\n\n---\n\n');
        console.log(`[ChatFlow] Pre-fetched RAG: ${ragDocs.length} docs -> ${relevantDocs.length} after dedupe for "${prompt.substring(0, 30)}..."`);
      } else if (intent === 'legal') {
        console.log(`[ChatFlow] RAG returned no relevant docs above threshold for "${prompt.substring(0, 30)}..."`);
      }
    } catch (ragErr) {
      console.error('[ChatFlow] RAG pre-fetch failed:', ragErr);
    }

    // Inject RAG context into the prompt
    if (ragContext) {
      finalPrompt += `\n\n[RETRIEVED LEGAL SOURCES - These are the ONLY sources you may state legal facts from]:\n${ragContext}\n\n[End of sources. Any legal fact not written above is NOT available to you. Say so instead of recalling it.]`;
    } else if (intent === 'legal') {
      finalPrompt += `\n\n[NO LEGAL SOURCES FOUND: The legal database returned nothing for this question. You MUST NOT state any section number, penalty, time limit or amount from memory. Say briefly that the exact legal provision was not found in the Lawslane database, then still give general practical next steps (rule B) and recommend consulting a lawyer on Lawslane.]`;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `You are LAlin, the expert female legal AI assistant for Lawslane Thailand. Your Thai name is spelled exactly "ลลิน" - never "ลาลิน" or "ละลิน".

GROUNDING RULES - two kinds of content, with different rules:

A) SPECIFIC LEGAL FACTS (strict):
- Section numbers (มาตรา), numbers of days, amounts of money, penalties, deadlines and limitation periods MUST appear VERBATIM in the retrieved sources. If not, do NOT write the figure - describe the rule in words and say the exact figure should be confirmed with a lawyer.
- NEVER produce a section number from memory.
- Cite inline by the law's name and section exactly as written INSIDE the source text, e.g. "(ประมวลกฎหมายแพ่งและพาณิชย์ มาตรา 1312)". If the source text does not name the law, give no citation for that statement. NEVER write the words "Source", "แหล่งที่มา" or any source number - the user cannot see the source list, so "(Source 2)" is meaningless to them. Never attach a citation to a statement that source does not support.
- AMENDED LAW: sources are tagged with the year of that version. If two sources state DIFFERENT numbers for the SAME rule, the source with the LATER year is the version in force; mention the earlier figure only as the superseded old version with its year.
- If sources disagree for any other reason, present both and say they differ.

B) PRACTICAL GUIDANCE (allowed from general knowledge):
- You MAY and SHOULD explain the practical options and next steps a Thai layperson normally takes, even when the sources do not spell them out - e.g. check the title deed (โฉนด), request a boundary survey (รังวัดสอบเขต) at the Land Office, collect evidence (photos, documents, witnesses), talk or send a written notice (หนังสือบอกกล่าว), file a police report for criminal matters, mediation, filing a civil suit, and consulting a lawyer.
- Keep this guidance general: no invented figures, fees, deadlines or section numbers.
- Where the sources support a point, anchor it with the citation; where they don't, present it as general practice.

NEVER reply with only "ไม่พบข้อมูล". A customer who asks what to do must always receive: (1) a short explanation of their legal position based on the sources, (2) concrete practical next steps, and (3) a closing suggestion to consult a lawyer on Lawslane for their specific facts. If an important detail is missing (e.g. whether a building or only a fence encroaches, or how long it has been there), answer the common scenarios briefly and ask ONE clarifying question at the end.

CONVERSATION STYLE:
- Respond naturally and conversationally, like chatting with a knowledgeable legal friend.
- Do NOT start every response with a fixed phrase like "LAlin สรุปให้ได้ว่า" or "สรุปเข้าใจง่ายโดย LAlin".
- Use a warm, polite female tone ("ค่ะ/นะคะ") and plain language accessible to non-lawyers.
- Vary your opening naturally based on context — sometimes summarize, sometimes explain, sometimes ask a clarifying question.
- When providing legal information from sources, naturally weave in the references rather than listing them rigidly.
- Feel free to use markdown formatting (bold, bullet points, etc.) to make the response easy to read.

Output format: Return ONLY a JSON object with a "sections" array. Do not include markdown formatting outside the JSON.
Each section can have: "title" (can be empty string for a natural flow), "content", "link" (optional), "linkText" (optional).
For simple conversational answers, use a single section with an empty title.
`,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    let formattedHistory: Content[] = [];
    if (history && history.length > 0) {
      // CAP: Limit history to last 12 messages to control token usage
      const recentHistory = history.slice(-12);
      
      const firstUserIndex = recentHistory.findIndex(h => h.role === 'user');
      
      if (firstUserIndex !== -1) {
        formattedHistory = recentHistory.slice(firstUserIndex).map(h => ({
          role: h.role,
          parts: h.content.map(c => ({ text: c.text }))
        }));
      }
    }

    const chatSession = model.startChat({
      history: formattedHistory,
    });

    let result = await chatSession.sendMessage(finalPrompt);

    let text = "";
    try {
      text = result.response.text();
    } catch (e: any) {
      console.error("[ChatFlow] Failed to get text from Gemini response (safety filters?):", e);
      throw new Error("Gemini response blocked or empty");
    }

    if (!text || text.trim() === "") {
      throw new Error("Empty response from Gemini");
    }

    console.log(`[ChatFlow] Primary AI raw response: ${text.substring(0, 500)}...`);

    // Clean up potential markdown code blocks if the model ignored MIME type
    let cleanJson = text;
    if (text.includes("```json")) {
      cleanJson = text.split("```json")[1].split("```")[0].trim();
    } else if (text.includes("```")) {
      cleanJson = text.split("```")[1].split("```")[0].trim();
    }

    try {
      return stripSourceTags(JSON.parse(cleanJson) as ChatResponse);
    } catch (parseError) {
      console.error("[ChatFlow] JSON Parse Error. Raw text:", text);
      throw parseError;
    }

  } catch (error: any) {
    console.error("[ChatFlow] Primary AI model failed:", error);
    console.error("[ChatFlow] Error Details:", JSON.stringify(error, null, 2));
    
    // Attempt fallback logic
    console.warn("[ChatFlow] Entering Fallback Mode (Typhoon AI)...");
    return stripSourceTags(await fallbackChat(prompt, history, locale, error));
  }
}

async function fallbackChat(prompt: string, history: any[], locale: string = 'th', cause?: Error): Promise<ChatResponse> {
  console.log("[ChatFlow] Running fallback chat logic...");
  const errorName = cause?.name || "Unknown";
  const errorMessage = cause?.message || "";
  
  try {
    const { firestore } = initializeFirebase();

    let languageInstruction = "ตอบเป็นภาษาไทย";
    if (locale.startsWith('en')) {
      languageInstruction = "Answer in English. IMPORTANT: For any specific legal terms, laws, or sensitive legal advice, you MUST provide the original Thai text alongside the English translation (e.g., 'Civil Code (ประมวลกฎหมายแพ่ง)').";
    }
    if (locale.startsWith('zh')) {
      languageInstruction = "Answer in Chinese (Simplified). IMPORTANT: For any specific legal terms, laws, or sensitive legal advice, you MUST provide the original Thai text alongside the Chinese translation.";
    }

    const t = {
      th: {
        greetingTitle: "สวัสดีค่ะ (โหมดสำรอง)",
        greetingContent: "สวัสดีค่ะ! ดิฉันคือ LAlin ผู้ช่วย AI (ในโหมดสำรอง) เนื่องจากระบบหลักขัดข้อง ดิฉันสามารถช่วยค้นหาข้อมูลกฎหมายเบื้องต้นจากฐานข้อมูลให้ได้ค่ะ ลองพิมพ์คำถามสั้นๆ เช่น 'มรดก', 'หย่า', หรือ 'สัญญา' ได้เลยนะคะ",
        knowledgeTitle: "แหล่งข้อมูลอ้างอิง (โหมดสำรอง)",
        knowledgeIntro: (terms: string) => `สรุปข้อมูลจากการค้นหาคำว่า "${terms}" พบแหล่งอ้างอิงดังนี้ค่ะ:`,
        relatedInfo: "ข้อมูลที่เกี่ยวข้อง",
        article: "บทความ",
        adviceTitle: "คำแนะนำเพิ่มเติม",
        adviceContent: "ข้อมูลข้างต้นเป็นเพียงการค้นหาเบื้องต้นจากฐานข้อมูล แนะนำให้ปรึกษาทนายความเพื่อความถูกต้องค่ะ",
        findLawyer: "ค้นหาทนายความผู้เชี่ยวชาญ",
        typhoonTitle: "คำตอบจาก LAlin (Typhoon)",
        typhoonAdviceTitle: "คำแนะนำ",
        typhoonAdviceContent: "คำตอบนี้สร้างโดย LAlin (ผ่าน Typhoon) จากความรู้ทั่วไป อาจไม่ครอบคลุมกฎหมายเฉพาะเจาะจง แนะนำให้ปรึกษาทนายความนะคะ",
        consultLawyerTitle: "แนะนำปรึกษาทนายความ",
        consultLawyerContent: (p: string) => `สำหรับหัวข้อ "${p}" เป็นประเด็นทางกฎหมายที่อาจมีรายละเอียดซับซ้อนเฉพาะบุคคล\n\nเพื่อให้คุณได้รับคำแนะนำที่ถูกต้องและรัดกุมที่สุด LAlin ขอแนะนำให้พูดคุยกับทนายความผู้เชี่ยวชาญโดยตรง เพื่อวิเคราะห์ข้อเท็จจริงในเชิงลึกค่ะ`,
        consultLawyerBtn: "ปรึกษาทนายความ",
        errorTitle: "ระบบขัดข้องชั่วคราว",
        errorContent: (msg: string) => `ขออภัยค่ะ ไม่สามารถเข้าถึงฐานข้อมูลได้ในขณะนี้ (${msg}) กรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่นะคะ`
      },
      en: {
        greetingTitle: "Hello (Backup Mode)",
        greetingContent: "Hello! I am the AI Assistant (in backup mode). Since the main system is currently unavailable, I can help you search for preliminary legal information from our database. Try typing short keywords like 'Inheritance', 'Divorce', or 'Contract'.",
        knowledgeTitle: "Knowledge Base Results (Backup Mode)",
        knowledgeIntro: (terms: string) => `Based on your search for "${terms}", here is the relevant information found:`,
        relatedInfo: "Related Information",
        article: "Article",
        adviceTitle: "Additional Advice",
        adviceContent: "The information above is a preliminary search from our database. We recommend consulting a lawyer for accuracy.",
        findLawyer: "Find a Lawyer",
        typhoonTitle: "Answer from AI (Typhoon)",
        typhoonAdviceTitle: "Advice",
        typhoonAdviceContent: "This answer was generated by AI (Typhoon) based on general knowledge and may not cover specific legal details. We recommend consulting a lawyer.",
        consultLawyerTitle: "Consult a Lawyer",
        consultLawyerContent: (p: string) => `Regarding "${p}", this is a legal issue that may have complex, case-specific details.\n\nTo receive the most accurate and comprehensive advice, we recommend speaking directly with a specialized lawyer to analyze the facts in depth.`,
        consultLawyerBtn: "Consult a Lawyer",
        errorTitle: "Temporary System Error",
        errorContent: (msg: string) => `Sorry, we cannot access the database at this time (${msg}). Please try again or contact support.`
      },
      zh: {
        greetingTitle: "你好 (备份模式)",
        greetingContent: "你好！我是 AI 助手（备份模式）。由于主系统暂时不可用，我可以帮助您从我们的数据库中搜索初步的法律信息。尝试输入简短的关键词，如“继承”、“离婚”或“合同”。",
        knowledgeTitle: "知识库结果 (备份模式)",
        knowledgeIntro: (terms: string) => `根据您搜索的 "${terms}"，以下是找到的相关信息：`,
        relatedInfo: "相关信息",
        article: "文章",
        adviceTitle: "额外建议",
        adviceContent: "以上信息仅为数据库的初步搜索结果。为了准确起见，我们建议咨询律师。",
        findLawyer: "寻找律师",
        typhoonTitle: "AI 回答 (Typhoon)",
        typhoonAdviceTitle: "建议",
        typhoonAdviceContent: "此回答由 AI (Typhoon) 基于一般知识生成，可能不涵盖具体的法律细节。我们建议咨询律师。",
        consultLawyerTitle: "咨询律师",
        consultLawyerContent: (p: string) => `关于 "${p}"，这是一个可能涉及复杂具体细节的法律问题。\n\n为了获得最准确和全面的建议，我们建议直接与专业律师交谈，深入分析事实。`,
        consultLawyerBtn: "咨询律师",
        errorTitle: "系统暂时故障",
        errorContent: (msg: string) => `抱歉，我们目前无法访问数据库 (${msg})。请重试或联系支持人员。`
      }
    };

    const strings = locale.startsWith('en') ? t.en : (locale.startsWith('zh') ? t.zh : t.th);

    // ทักทาย/คุยเล่น -> ตอบทักทายกลับไปเลย ไม่ต้องค้นฐานข้อมูลกฎหมาย
    if (detectIntent(prompt) === 'smalltalk') {
      console.log('[ChatFlow] Fallback: smalltalk detected, skipping legal search.');
      return {
        sections: [
          {
            title: strings.greetingTitle,
            content: strings.greetingContent,
          },
        ],
      };
    }

    const lowerCaseQuery = prompt.toLowerCase();

    const cleanPrompt = lowerCaseQuery
      .replace(/^(คดี|กฎหมาย|เรื่อง|การ|ความ|ข้อหา|มี|เป็น)/g, '')
      .trim();

    // Strategy 1: Search terms for substring matching
    // Filter out very common noise and short words
    const noiseWords = ['ของ', 'ใน', 'กับ', 'คือ', 'และ'];
    const searchTerms = cleanPrompt.split(/\s+/)
      .filter(w => w.length > 2 && !noiseWords.includes(w));
    
    if (searchTerms.length === 0 && cleanPrompt.length > 0) {
      searchTerms.push(cleanPrompt);
    }
    
    // Parallelize all data fetching
    const [snapshot, allDocs] = await Promise.all([
      (async () => {
        if (!firestore) return null;
        const articlesRef = collection(firestore, 'articles');
        const q = query(articlesRef, limit(50)); // Increase limit for better matching locally
        return getDocs(q);
      })(),
      retrieveDocuments(cleanPrompt)
    ]);

    // 1. Process local articles with better relevance scoring
    const articles = snapshot?.docs.map(doc => {
      const data = doc.data();
      const title = (data.title || '').toLowerCase();
      const content = (data.content || '').toLowerCase();
      
      // Calculate a crude relevance score
      let score = 0;
      if (title.includes(cleanPrompt)) score += 10;
      if (content.includes(cleanPrompt)) score += 5;
      
      searchTerms.forEach(term => {
        if (title.includes(term)) score += 3;
        if (content.includes(term)) score += 1;
      });

      return {
        id: doc.id,
        title: data.title || '',
        content: data.content || '',
        score
      };
    }).filter(a => a.score > 0).sort((a, b) => b.score - a.score) || [];

    const relevantArticles = articles.slice(0, 3);

    // 2. Process RAG documents
    const ragDocs = (allDocs || []).filter(doc => doc.score > 0.5 && doc.content.trim().length > 15);
    console.log(`[ChatFlow] RAG found ${allDocs?.length || 0} docs, ${ragDocs.length} passed threshold & quality filter.`);

    const sections = [];

    if (relevantArticles.length > 0 || ragDocs.length > 0) {
      sections.push({
        title: strings.knowledgeTitle,
        content: strings.knowledgeIntro(searchTerms.join('", "'))
      });

      if (ragDocs.length > 0) {
        // SYNTHESIZED FALLBACK: Use Typhoon to summarize RAG results
        console.log("[ChatFlow] Synthesizing RAG results with Typhoon AI...");
        console.log(`[ChatFlow] Synthesizing RAG results with Typhoon AI (Key: ${!!process.env.TYPHOON_API_KEY})...`);
        
        const contextWithSources = ragDocs.map((d, i) => `Source [${i+1}]: ${formatSourceTitle(d.source)}\nContent: ${d.content}`).join("\n\n---\n\n");
        
        let typhoonSummary = await callTyphoonAI(
          `User Question: ${prompt}\n\nRelated Legal Context with Sources:\n${contextWithSources}\n\nInstructions:
1. You are LAlin (Thai name spelled exactly "ลลิน", never "ลาลิน"), a professional female legal assistant. Use a polite female tone ("ค่ะ/นะคะ").
2. Answer naturally and conversationally based on the provided context. DO NOT add information not found in the context.
3. Put all citations at the end in a "รายการอ้างอิง" section.
4. **NO LINKS**: Use plain text for citations: "อ้างอิง: [ชื่อกฎหมายฉบับเต็ม] มาตรา XXX". DO NOT use markdown links or URLs.
5. **PLAIN LANGUAGE SUMMARY**: At the end, include a short, easy-to-understand summary section for non-lawyers.
   Do NOT start with "LAlin สรุปให้ได้ว่า" — just explain clearly and naturally.
   **IMPORTANT**: Precede this summary section with the exact delimiter: [LALIN_SUMMARY].
6. Use full names for laws (e.g. ประมวลกฎหมายแพ่งและพาณิชย์, ประมวลกฎหมายอาญา).
6. CLEAN UP formatting: Remove raw JSON sequences, literal \\n strings, or table markdown characters (| or ---) from the sources in your summary.
7. ${languageInstruction}.`,
          languageInstruction
        );

        if (typhoonSummary) {
          // Additional safety cleanup for literal \n or escaped JSON
          const cleanedSummary = typhoonSummary
            .replace(/\\n/g, '\n')
            .replace(/\\\\n/g, '\n')
            .replace(/\{"natural_text":\s*"/g, '')
            .replace(/"\}/g, '')
            .replace(/\| --- \| --- \|/g, '')
            .replace(/\|/g, ' ')
            .trim();

          // Split by delimiter if Typhoon followed instructions
          if (cleanedSummary.includes('[LALIN_SUMMARY]')) {
            const [mainContent, lalinSummary] = cleanedSummary.split('[LALIN_SUMMARY]');
            
            if (mainContent.trim()) {
              sections.push({
                title: locale.startsWith('th') ? "รายละเอียดข้อกฎหมาย" : "Legal Details",
                content: mainContent.trim()
              });
            }
            
            if (lalinSummary.trim()) {
              sections.push({
                title: "",
                content: lalinSummary.trim().replace(/^สรุปเข้าใจง่ายโดย LAlin[\s:]*/, '').replace(/^LAlin สรุปให้ได้ว่า[\s.]*/, '')
              });
            }
          } else {
            // Fallback if delimiter is missing
            sections.push({
              title: locale.startsWith('th') ? "สรุปข้อมูลกฎหมายเบื้องต้น" : "Legal Summary",
              content: cleanedSummary
            });
          }
        }
      }

      relevantArticles.forEach(article => {
        sections.push({
          title: `${strings.article}: ${article.title}`,
          content: article.content.substring(0, 300) + "..."
        });
      });

      sections.push({
        title: strings.adviceTitle,
        content: strings.adviceContent,
        link: "/lawyers",
        linkText: strings.findLawyer
      });
    } else {
      console.log("[ChatFlow] No RAG results, asking Typhoon...");
      const typhoonResponse = await callTyphoonAI(prompt, languageInstruction);

      if (typhoonResponse) {
        sections.push({
          title: strings.typhoonTitle,
          content: typhoonResponse
        });
        sections.push({
          title: strings.typhoonAdviceTitle,
          content: strings.typhoonAdviceContent,
          link: "/lawyers",
          linkText: strings.consultLawyerBtn
        });
      } else {
        sections.push({
          title: strings.consultLawyerTitle,
          content: strings.consultLawyerContent(prompt),
          link: "/lawyers",
          linkText: strings.findLawyer
        });
      }
    }

    return { sections };
  } catch (error: any) {
    console.error("[ChatFlow] Fallback logic failed:", error);
    const errorMsg = locale.startsWith('en')
      ? `Sorry, we cannot access the database at this time (${error?.message || 'Unknown Error'}). Please try again.`
      : (locale.startsWith('zh')
        ? `抱歉，我们目前无法访问数据库 (${error?.message || 'Unknown Error'})。请重试。`
        : `ขออภัยค่ะ ไม่สามารถเข้าถึงฐานข้อมูลได้ในขณะนี้ (${error?.message || 'Unknown Error'}) กรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่`);

    return {
      sections: [
        {
          title: "System Error",
          content: errorMsg
        }
      ]
    };
  }
}
