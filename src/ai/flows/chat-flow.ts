
'use server';
/**
 * @fileOverview A simple chat flow that uses the Gemini model with RAG.
 *
 * - chat - A function that handles the chat process.
 */

import {ai} from '@/ai/genkit';
import {MessageData} from 'genkit';
import {z} from 'zod';
import { getAllArticles } from '@/lib/data';
import { Article } from '@/lib/types';

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
    const articles = await getAllArticles();
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
      content: z.array(z.object({text: z.string()})),
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
  const {history, prompt} = request;

  const { output } = await chatPrompt({
      history: history as MessageData[],
      prompt,
  });

  return output!;
}
