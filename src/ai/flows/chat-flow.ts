
'use server';
/**
 * @fileOverview A simple chat flow that uses the Gemini model with RAG.
 *
 * - chat - A function that handles the chat process.
 */

import { ai } from '@/ai/genkit';
import { MessageData } from 'genkit';
import { z } from 'zod';
import { getAllArticles } from '@/lib/data';
import { Article } from '@/lib/types';

import { initializeFirebase } from '@/firebase';

// Define the tool for searching articles
import { retrieveContext, retrieveDocuments } from '@/lib/rag';
import { callTyphoonAI } from '@/lib/typhoon';

// Define the tool for searching articles and RAG context
const searchArticlesTool = ai.defineTool(
  {
    name: 'searchArticles',
    description: 'Search for relevant legal information from the knowledge base (PDFs and Articles).',
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant information.'),
    }),
    outputSchema: z.object({
      results: z.array(
        z.object({
          title: z.string(),
          content: z.string(),
        })
      ),
    }),
  },
  async (input) => {
    console.log(`[searchArticlesTool] Searching for: ${input.query}`);

    // 1. Search RAG (Cloudflare)
    let ragDocs: Array<{ source: string, content: string, score: number }> = [];
    try {
      const allDocs = await retrieveDocuments(input.query);
      // Filter by similarity score (threshold 0.6)
      ragDocs = allDocs.filter(doc => doc.score > 0.6);
      console.log(`[searchArticlesTool] RAG found ${allDocs.length} docs, ${ragDocs.length} passed threshold.`);
    } catch (err) {
      console.error("RAG search failed:", err);
    }

    const results = [];

    if (ragDocs.length > 0) {
      // Case A: Found specific legal documents
      ragDocs.forEach(doc => {
        results.push({
          title: "ข้อมูลจากเอกสารกฎหมาย (PDF)",
          content: doc.content
        });
      });
    } else {
      // Case B: No documents found -> Ask Typhoon (General Knowledge Fallback)
      console.log("[searchArticlesTool] No relevant RAG docs. Asking Typhoon...");
      const typhoonResponse = await callTyphoonAI(input.query);
      if (typhoonResponse) {
        results.push({
          title: "ข้อมูลความรู้ทั่วไป (จาก Typhoon AI)",
          content: typhoonResponse
        });
      }
    }

    // 2. Search Articles (Firestore) - Keep as secondary source if RAG failed? 
    // For now, let's prioritize RAG/Typhoon to keep it clean, or append if RAG found nothing.
    // Let's append Firestore only if we have results, to avoid noise? 
    // Actually, existing logic appended it. Let's keep it but maybe filter strictly.

    return { results };
  }
);


const ChatRequestSchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      content: z.array(z.object({ text: z.string() })),
    })
  ),
  prompt: z.string(),
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

const chatPrompt = ai.definePrompt({
  name: 'chatPrompt',
  input: { schema: ChatRequestSchema },
  output: { schema: ChatResponseSchema },
  tools: [searchArticlesTool],
  system: `You are an AI legal assistant for Lawslane, a legal tech platform in Thailand.
    Your role is to provide preliminary analysis and information, not definitive legal advice.
    
    Always follow these steps:
    1.  First, use the \`searchArticles\` tool to find relevant information.
    2.  If the tool returns "Legal Documents (PDF)", treat this as high-confidence legal information. Base your answer primarily on this.
    3.  If the tool returns "General Knowledge (Typhoon AI)", this means no specific legal document was found. Use this information to answer the user's question but explicitly state that it is general knowledge, not specific legal advice from the database.
    4.  If no information is found at all, answer based on your own general knowledge.
    5.  Always conclude your response by reminding the user that your analysis is for informational purposes only and they should consult with a qualified lawyer for formal advice.
    6.  If the user's question is complex or requires legal action (e.g., suing, drafting contracts), add a section with a Call to Action to "Find a Lawyer" linking to "/lawyers".
    7.  All responses must be in Thai.
    8.  Only introduce yourself as the AI assistant in the very first response of the conversation. For subsequent messages, answer directly without re-introducing yourself.
    `,
  prompt: `User prompt: {{{prompt}}}`,
});


export async function chat(
  request: z.infer<typeof ChatRequestSchema>
): Promise<ChatResponse> {
  const { history, prompt } = request;

  try {
    // Check if API key is set (basic check)
    if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
      console.warn("[ChatFlow] No Google API Key found. Falling back to manual mode.");
      throw new Error("No API Key");
    }

    const { output } = await chatPrompt({
      history,
      prompt,
    });

    return output!;
  } catch (error) {
    console.error("[ChatFlow] AI generation failed:", error);

    // Fallback: Manual RAG (Search + Template)
    // This ensures the chat "works" even without a valid API key or if the model is overloaded.
    return await fallbackChat(prompt);
  }
}

import { collection, getDocs, limit, query } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

async function fallbackChat(prompt: string): Promise<ChatResponse> {
  console.log("[ChatFlow] Running fallback chat logic...");
  try {
    const { firestore, auth } = initializeFirebase();

    // Try to sign in anonymously to ensure we have a valid session
    // This helps avoid "Missing or insufficient permissions" in some server environments
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
        console.log("[ChatFlow] Signed in anonymously for fallback search");
      }
    } catch (authError) {
      console.warn("[ChatFlow] Anonymous auth failed (ignoring):", authError);
    }

    // Use Client SDK with simple query
    const articlesRef = collection(firestore, 'articles');
    const q = query(articlesRef, limit(20));
    const snapshot = await getDocs(q);

    const articles = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        content: data.content || '',
      };
    });

    const lowerCaseQuery = prompt.toLowerCase();

    // 1. Handle Greetings
    const greetings = ['สวัสดี', 'หวัดดี', 'hello', 'hi', 'ทักทาย'];
    if (greetings.some(g => lowerCaseQuery.includes(g))) {
      return {
        sections: [{
          title: "สวัสดีครับ (โหมดสำรอง)",
          content: "สวัสดีครับ! ผมคือผู้ช่วย AI (ในโหมดสำรอง) เนื่องจากระบบหลักขัดข้อง ผมสามารถช่วยค้นหาข้อมูลกฎหมายเบื้องต้นจากฐานข้อมูลให้ได้ครับ ลองพิมพ์คำถามสั้นๆ เช่น 'มรดก', 'หย่า', หรือ 'สัญญา' ได้เลยครับ"
        }]
      };
    }

    // 2. Smart Keyword Search
    // Remove common Thai prefixes to find the core keyword
    // e.g. "คดีมรดก" -> "มรดก", "กฎหมายที่ดิน" -> "ที่ดิน"
    const cleanPrompt = lowerCaseQuery
      .replace(/^(คดี|กฎหมาย|เรื่อง|การ|ความ|ข้อหา)/, '')
      .trim();

    const searchTerms = cleanPrompt.split(/\s+/).filter(w => w.length > 1);
    // Add the original prompt back just in case
    if (cleanPrompt !== lowerCaseQuery) {
      searchTerms.push(lowerCaseQuery);
    }

    const relevantArticles = articles
      .filter(article => {
        const title = article.title.toLowerCase();
        const content = article.content.toLowerCase();
        // Match if ANY search term is found in title or content
        return searchTerms.some(term => title.includes(term) || content.includes(term));
      })
      .slice(0, 3);

    const sections = [];

    // 3. Search RAG (Cloudflare) for Fallback
    let ragDocs: Array<{ source: string, content: string, score: number }> = [];
    try {
      const allDocs = await retrieveDocuments(cleanPrompt);
      // Filter by similarity score (threshold 0.6 to avoid irrelevant garbage)
      ragDocs = allDocs.filter(doc => doc.score > 0.6);
      console.log(`[ChatFlow] RAG found ${allDocs.length} docs, ${ragDocs.length} passed threshold.`);
    } catch (err) {
      console.error("Fallback RAG search failed:", err);
    }

    if (relevantArticles.length > 0 || ragDocs.length > 0) {
      sections.push({
        title: "ข้อมูลจากฐานความรู้ (โหมดสำรอง)",
        content: `จากการค้นหาคำว่า "${searchTerms.join('", "')}" พบข้อมูลที่เกี่ยวข้องดังนี้ครับ:`
      });

      if (ragDocs.length > 0) {
        ragDocs.forEach((doc, index) => {
          const cleanContent = doc.content.trim();
          if (cleanContent) {
            sections.push({
              title: `ข้อมูลที่เกี่ยวข้อง (${index + 1})`,
              content: cleanContent
            });
          }
        });
      }

      relevantArticles.forEach(article => {
        sections.push({
          title: `บทความ: ${article.title}`,
          content: article.content.substring(0, 300) + "..." // Summary
        });
      });

      sections.push({
        title: "คำแนะนำเพิ่มเติม",
        content: "ข้อมูลข้างต้นเป็นเพียงการค้นหาเบื้องต้นจากฐานข้อมูล แนะนำให้ปรึกษาทนายความเพื่อความถูกต้องครับ",
        link: "/lawyers",
        linkText: "ค้นหาทนายความผู้เชี่ยวชาญ"
      });
    } else {
      // 4. If no RAG/Articles, try Typhoon AI (General Knowledge)
      console.log("[ChatFlow] No RAG results, asking Typhoon...");
      const typhoonResponse = await callTyphoonAI(prompt);

      if (typhoonResponse) {
        sections.push({
          title: "คำตอบจาก AI (Typhoon)",
          content: typhoonResponse
        });
        sections.push({
          title: "คำแนะนำ",
          content: "คำตอบนี้สร้างโดย AI (Typhoon) จากความรู้ทั่วไป อาจไม่ครอบคลุมกฎหมายเฉพาะเจาะจง แนะนำให้ปรึกษาทนายความ",
          link: "/lawyers",
          linkText: "ปรึกษาทนายความ"
        });
      } else {
        sections.push({
          title: "แนะนำปรึกษาทนายความ",
          content: `สำหรับหัวข้อ "${prompt}" เป็นประเด็นทางกฎหมายที่อาจมีรายละเอียดซับซ้อนเฉพาะบุคคล\n\nเพื่อให้คุณได้รับคำแนะนำที่ถูกต้องและรัดกุมที่สุด ระบบขอแนะนำให้พูดคุยกับทนายความผู้เชี่ยวชาญโดยตรง เพื่อวิเคราะห์ข้อเท็จจริงในเชิงลึกครับ`,
          link: "/lawyers",
          linkText: "ค้นหาทนายความผู้เชี่ยวชาญ"
        });
      }
    }


    return { sections };
  } catch (error: any) {
    console.error("[ChatFlow] Fallback logic failed:", error);
    console.error("[ChatFlow] Error details:", JSON.stringify(error, null, 2));
    // Ultimate fallback if even Firestore fails
    return {
      sections: [
        {
          title: "ระบบขัดข้องชั่วคราว",
          content: `ขออภัยครับ ไม่สามารถเข้าถึงฐานข้อมูลได้ในขณะนี้ (${error?.message || 'Unknown Error'}) กรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่`
        }
      ]
    };
  }
}
