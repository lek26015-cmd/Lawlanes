
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
const searchArticlesTool = ai.defineTool(
  {
    name: 'searchArticles',
    description: 'Search for relevant legal articles from the Lawlanes knowledge base.',
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant articles.'),
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
    const { firestore } = initializeFirebase();
    const articles = await getAllArticles(firestore);
    const lowerCaseQuery = input.query.toLowerCase();

    const filteredArticles = articles
      .filter(article =>
        article.title.toLowerCase().includes(lowerCaseQuery) ||
        article.description.toLowerCase().includes(lowerCaseQuery) ||
        article.content.toLowerCase().includes(lowerCaseQuery)
      )
      .slice(0, 3); // Return top 3 results to keep the context small

    return {
      results: filteredArticles.map(a => ({ title: a.title, content: a.content })),
    };
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
  })).describe('An array of sections to structure the response.'),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

const chatPrompt = ai.definePrompt({
  name: 'chatPrompt',
  input: { schema: ChatRequestSchema },
  output: { schema: ChatResponseSchema },
  tools: [searchArticlesTool],
  system: `You are an AI legal assistant for Lawlanes, a legal tech platform in Thailand.
    Your role is to provide preliminary analysis and information, not definitive legal advice.
    
    Always follow these steps:
    1.  First, use the \`searchArticles\` tool to find relevant articles from the knowledge base based on the user's prompt.
    2.  If you find relevant articles, base your answer primarily on the information from those articles. Structure your response into clear sections.
    3.  If you do not find any relevant articles, inform the user that you couldn't find specific information in the knowledge base and then answer based on your general knowledge.
    4.  Always conclude your response by reminding the user that your analysis is for informational purposes only and they should consult with a qualified lawyer for formal advice.
    5.  All responses must be in Thai.
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

async function fallbackChat(prompt: string): Promise<ChatResponse> {
  console.log("[ChatFlow] Running fallback chat logic...");
  const { firestore } = initializeFirebase();
  const articles = await getAllArticles(firestore);
  const lowerCaseQuery = prompt.toLowerCase();

  // Simple keyword search
  const relevantArticles = articles
    .filter(article =>
      article.title.toLowerCase().includes(lowerCaseQuery) ||
      article.content.toLowerCase().includes(lowerCaseQuery)
    )
    .slice(0, 2);

  const sections = [];

  if (relevantArticles.length > 0) {
    sections.push({
      title: "ข้อมูลจากฐานความรู้ (โหมดสำรอง)",
      content: "จากการค้นหาข้อมูลเบื้องต้น พบประเด็นที่เกี่ยวข้องดังนี้ครับ:"
    });

    relevantArticles.forEach(article => {
      sections.push({
        title: article.title,
        content: article.content.substring(0, 300) + "..." // Summary
      });
    });

    sections.push({
      title: "คำแนะนำเพิ่มเติม",
      content: "ระบบ AI หลักกำลังปรับปรุงหรือขัดข้อง ข้อมูลข้างต้นเป็นเพียงการค้นหาเบื้องต้น แนะนำให้ปรึกษาทนายความเพื่อความถูกต้องครับ"
    });
  } else {
    sections.push({
      title: "ไม่พบข้อมูลที่ตรงกัน (โหมดสำรอง)",
      content: "ขออภัยครับ ระบบไม่พบข้อมูลที่ตรงกับคำถามในฐานข้อมูลเบื้องต้น และไม่สามารถเชื่อมต่อกับ AI หลักได้ในขณะนี้\n\nแนะนำให้ท่าน:\n1. ลองใช้คำค้นหาอื่น\n2. กดปุ่ม 'ปรึกษาทนายความ' เพื่อคุยกับทนายตัวจริง"
    });
  }

  return { sections };
}
