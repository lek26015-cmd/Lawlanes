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

export async function chat(
  request: z.infer<typeof ChatRequestSchema>
): Promise<string> {
  const {history, prompt} = request;
  const {text} = await ai.generate({
    prompt,
    history: history as MessageData[],
    config: {
      temperature: 1,
    },
  });
  return text;
}
