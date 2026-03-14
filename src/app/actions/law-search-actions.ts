'use server';

import { retrieveDocuments } from '@/lib/rag';

export type SearchResult = {
    source: string;
    content: string;
    score: number;
};

export async function searchLaws(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!query || query.trim() === '') return [];

    try {
        // Use the existing RAG utility to fetch chunks
        const results = await retrieveDocuments(query, limit);
        
        // Filter out low scores and sort by highest score
        return results
            .filter(r => r.score > 0.5)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    } catch (error) {
        console.error('[Semantic Search] Error fetching laws:', error);
        return [];
    }
}
