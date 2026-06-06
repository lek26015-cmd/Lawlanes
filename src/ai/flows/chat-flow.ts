'use server';
/**
 * @fileOverview A simple chat flow that uses the Gemini model with RAG.
 */

import { z } from 'zod';
import { initializeFirebase } from '@/firebase';
import { retrieveDocuments } from '@/lib/rag';
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

export async function chat(
  request: z.infer<typeof ChatRequestSchema>
): Promise<ChatResponse> {
  const { history, prompt, locale = 'th' } = request;

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ functionDeclarations: [searchArticlesDeclaration] }],
      systemInstruction: `You are LAlin (ละลิน), the expert female legal AI assistant for Lawslane Thailand.

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

    // Handle function calls if any
    if (result.response.functionCalls()) {
      const calls = result.response.functionCalls();
      for (const call of calls || []) {
        if (call.name === "searchArticles") {
          const args = call.args as { query: string };
          const toolResult = await executeSearchArticles(args.query);
          result = await chatSession.sendMessage([{
            functionResponse: {
              name: "searchArticles",
              response: toolResult
            }
          }]);
        }
      }
    }

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
      return JSON.parse(cleanJson) as ChatResponse;
    } catch (parseError) {
      console.error("[ChatFlow] JSON Parse Error. Raw text:", text);
      throw parseError;
    }

  } catch (error: any) {
    console.error("[ChatFlow] Primary AI model failed:", error);
    console.error("[ChatFlow] Error Details:", JSON.stringify(error, null, 2));
    
    // Attempt fallback logic
    console.warn("[ChatFlow] Entering Fallback Mode (Typhoon AI)...");
    return await fallbackChat(prompt, history, locale, error);
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

    const lowerCaseQuery = prompt.toLowerCase();
    
    // Quick handle for greetings to save RAG/Firestore calls
    const greetings = ['สวัสดี', 'หวัดดี', 'hello', 'hi', 'ทักทาย', '你好'];
    if (greetings.some(g => lowerCaseQuery.includes(g))) {
      return {
        sections: [{
          title: strings.greetingTitle,
          content: strings.greetingContent
        }]
      };
    }

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
1. You are LAlin (ละลิน), a professional female legal assistant. Use a polite female tone ("ค่ะ/นะคะ").
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
