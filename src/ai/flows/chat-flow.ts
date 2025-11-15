'use server';
/**
 * @fileOverview A simple chat flow that uses the Gemini model.
 *
 * - chat - A function that handles the chat process.
 */

import {ai} from '@/ai/genkit';
import {MessageData} from 'genkit';
import {z} from 'zod';

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
    prompt: `You are an AI legal assistant. Provide a structured response to the user's prompt. 
    Break down your answer into logical sections, each with a clear title and content.
    User prompt: {{{prompt}}}
    `,
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
