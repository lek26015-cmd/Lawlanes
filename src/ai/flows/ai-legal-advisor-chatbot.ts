'use server';

/**
 * @fileOverview AI Legal Advisor chatbot flow for preliminary legal assessments.
 *
 * - aiLegalAdvisorChatbot - A function that handles the chatbot interaction.
 * - AiLegalAdvisorChatbotInput - The input type for the aiLegalAdvisorChatbot function.
 * - AiLegalAdvisorChatbotOutput - The return type for the aiLegalAdvisorChatbot function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiLegalAdvisorChatbotInputSchema = z.object({
  query: z.string().describe('The user query for the AI Legal Advisor.'),
});
export type AiLegalAdvisorChatbotInput = z.infer<
  typeof AiLegalAdvisorChatbotInputSchema
>;

const AiLegalAdvisorChatbotOutputSchema = z.object({
  response: z.string().describe('The response from the AI Legal Advisor.'),
  needsLawyer: z
    .boolean()
    .describe(
      'Whether the AI determines that the user needs to consult a lawyer.'
    ),
});
export type AiLegalAdvisorChatbotOutput = z.infer<
  typeof AiLegalAdvisorChatbotOutputSchema
>;

export async function aiLegalAdvisorChatbot(
  input: AiLegalAdvisorChatbotInput
): Promise<AiLegalAdvisorChatbotOutput> {
  return aiLegalAdvisorChatbotFlow(input);
}

const assessCaseComplexity = ai.defineTool({
  name: 'assessCaseComplexity',
  description: 'Assesses the complexity of a legal case to determine if a lawyer is needed.',
  inputSchema: z.object({
    query: z.string().describe('The user query describing their legal issue.'),
  }),
  outputSchema: z.boolean().describe('True if a lawyer is needed, false otherwise.'),
},
async (input) => {
    // Simulate assessing case complexity, always return true for now
    //In the future, this could use another LLM or a rules engine to determine
    //if a lawyer is needed.
    return true;
  }
);

const aiLegalAdvisorChatbotPrompt = ai.definePrompt({
  name: 'aiLegalAdvisorChatbotPrompt',
  input: {schema: AiLegalAdvisorChatbotInputSchema},
  output: {schema: AiLegalAdvisorChatbotOutputSchema},
  tools: [assessCaseComplexity],
  prompt: `You are an AI Legal Advisor specializing in civil and commercial law, especially concerning fraud and breach of contract. Provide preliminary legal assessments based on the user's query.  Your response should sound like it comes from a lawyer.

  If the user asks a question unrelated to civil or commercial law, politely decline to answer.

  If the user is asking about a complex case that requires a lawyer, use the assessCaseComplexity tool to determine if a lawyer is needed. If the tool returns true, indicate in your response that the user needs to consult a lawyer and set needsLawyer to true.

  Disclaimer: This is not legal advice, it is only a preliminary assessment.

  User Query: {{{query}}} `,
});

const aiLegalAdvisorChatbotFlow = ai.defineFlow(
  {
    name: 'aiLegalAdvisorChatbotFlow',
    inputSchema: AiLegalAdvisorChatbotInputSchema,
    outputSchema: AiLegalAdvisorChatbotOutputSchema,
  },
  async input => {
    const {output} = await aiLegalAdvisorChatbotPrompt(input);
    return output!;
  }
);
