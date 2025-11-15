'use server';

import { aiLegalAdvisorChatbot } from '@/ai/flows/ai-legal-advisor-chatbot';
import { caseHandoffToLawyers } from '@/ai/flows/case-handoff-to-lawyers';
import { z } from 'zod';

const chatSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
});

export async function getAiChatResponse(input: { query: string }) {
  try {
    const validatedInput = chatSchema.parse(input);
    const advisorResult = await aiLegalAdvisorChatbot({ query: validatedInput.query });

    let handoffMessage: string | undefined = undefined;

    if (advisorResult.needsLawyer) {
      const handoffResult = await caseHandoffToLawyers({ userQuery: validatedInput.query });
      if (handoffResult.needsLawyer && handoffResult.handoffMessage) {
        handoffMessage = handoffResult.handoffMessage;
      }
    }

    return {
      success: true,
      data: {
        response: advisorResult.response,
        needsLawyer: advisorResult.needsLawyer,
        handoffMessage: handoffMessage,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input.' };
    }
    console.error('AI Chat Error:', error);
    return { success: false, error: 'An unexpected error occurred while communicating with the AI. Please try again later.' };
  }
}
