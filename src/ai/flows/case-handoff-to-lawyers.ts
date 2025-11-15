'use server';

/**
 * @fileOverview Determines if a case requires a lawyer and provides a handoff message.
 *
 * - caseHandoffToLawyers - A function that determines if a case requires a lawyer and returns a message with a call to action.
 * - CaseHandoffToLawyersInput - The input type for the caseHandoffToLawyers function.
 * - CaseHandoffToLawyersOutput - The return type for the caseHandoffToLawyers function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CaseHandoffToLawyersInputSchema = z.object({
  userQuery: z.string().describe('The user query or description of their legal issue.'),
});
export type CaseHandoffToLawyersInput = z.infer<typeof CaseHandoffToLawyersInputSchema>;

const CaseHandoffToLawyersOutputSchema = z.object({
  needsLawyer: z.boolean().describe('Whether the case requires a lawyer.'),
  handoffMessage: z.string().optional().describe('A message with a call to action to view a list of lawyers, if needed.'),
});
export type CaseHandoffToLawyersOutput = z.infer<typeof CaseHandoffToLawyersOutputSchema>;

export async function caseHandoffToLawyers(input: CaseHandoffToLawyersInput): Promise<CaseHandoffToLawyersOutput> {
  return caseHandoffToLawyersFlow(input);
}

const prompt = ai.definePrompt({
  name: 'caseHandoffToLawyersPrompt',
  input: {schema: CaseHandoffToLawyersInputSchema},
  output: {schema: CaseHandoffToLawyersOutputSchema},
  prompt: `Based on the user's query: "{{userQuery}}", determine if their case requires a lawyer.

  Respond with JSON. Set needsLawyer to true if the case is complex or requires specialized legal assistance. If needsLawyer is true, also generate a handoffMessage encouraging the user to view a list of lawyers.

  The handoffMessage should clearly state that the user's case requires expert assistance and provide a call to action to navigate to the lawyers page.
  If the case does not need a lawyer, return needsLawyer as false and do not include a handoffMessage.
`,
});

const caseHandoffToLawyersFlow = ai.defineFlow(
  {
    name: 'caseHandoffToLawyersFlow',
    inputSchema: CaseHandoffToLawyersInputSchema,
    outputSchema: CaseHandoffToLawyersOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
