'use server';
/**
 * @fileOverview An AI flow to find lawyer specialties based on a user's problem description.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const FindLawyersInputSchema = z.object({
  problem: z.string().describe("The user's description of their legal problem."),
});

const FindLawyersOutputSchema = z.object({
  specialties: z.array(z.string()).describe('A list of lawyer specialties relevant to the problem.'),
});

export type FindLawyersInput = z.infer<typeof FindLawyersInputSchema>;
export type FindLawyersOutput = z.infer<typeof FindLawyersOutputSchema>;

const lawyerSpecialties = [
  'คดีฉ้อโกง SMEs',
  'คดีแพ่งและพาณิชย์',
  'การผิดสัญญา',
];

const findLawyersPrompt = ai.definePrompt({
  name: 'findLawyersPrompt',
  input: { schema: FindLawyersInputSchema },
  output: { schema: FindLawyersOutputSchema },
  prompt: `You are an AI assistant that categorizes legal problems to help users find the right lawyer.
Based on the user's problem description, identify the relevant specialties from the following list.
Return one or more matching specialties. If no specialty matches, return an empty array.

Available Specialties:
${lawyerSpecialties.map(s => `- ${s}`).join('\n')}

User's Problem: {{{problem}}}
`,
});

export async function findLawyerSpecialties(input: FindLawyersInput): Promise<FindLawyersOutput> {
    const { output } = await findLawyersPrompt(input);
    return output!;
}
