
'use server';
/**
 * @fileOverview An AI flow to find lawyer specialties based on a user's problem description.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getAllLawyers } from '@/lib/data';
import { Firestore, getFirestore } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const FindLawyersInputSchema = z.object({
  problem: z.string().describe("The user's description of their legal problem."),
});

const FindLawyersOutputSchema = z.object({
  specialties: z.array(z.string()).describe('A list of lawyer specialties relevant to the problem.'),
});

export type FindLawyersInput = z.infer<typeof FindLawyersInputSchema>;
export type FindLawyersOutput = z.infer<typeof FindLawyersOutputSchema>;

// This function now dynamically fetches specialties from Firestore
async function getDynamicLawyerSpecialties(db: Firestore): Promise<string[]> {
    const lawyers = await getAllLawyers(db);
    const allSpecialties = lawyers.flatMap(lawyer => lawyer.specialty);
    // Return unique specialties
    return [...new Set(allSpecialties)];
}


const findLawyersPrompt = ai.definePrompt({
  name: 'findLawyersPrompt',
  input: { schema: z.object({
      problem: z.string(),
      specialties: z.array(z.string()),
  }) },
  output: { schema: FindLawyersOutputSchema },
  prompt: `You are an AI assistant that categorizes legal problems to help users find the right lawyer.
Based on the user's problem description, identify the relevant specialties from the following list.
Return one or more matching specialties. If no specialty matches, return an empty array.

Available Specialties:
{{#each specialties}}
- {{{this}}}
{{/each}}

User's Problem: {{{problem}}}
`,
});

export async function findLawyerSpecialties(input: FindLawyersInput): Promise<FindLawyersOutput> {
    const { firestore } = initializeFirebase();
    const dynamicSpecialties = await getDynamicLawyerSpecialties(firestore);

    const { output } = await findLawyersPrompt({
        problem: input.problem,
        specialties: dynamicSpecialties,
    });
    return output!;
}
