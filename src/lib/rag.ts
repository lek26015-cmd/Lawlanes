
const WORKER_URL = 'https://lawslane-rag-api.lawslane-app.workers.dev';

export async function retrieveDocuments(query: string, topK: number = 5): Promise<Array<{ source: string, content: string, score: number }>> {
    try {
        console.log(`Querying Cloudflare RAG for: "${query}"`);

        const response = await fetch(`${WORKER_URL}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: query })
        });

        if (!response.ok) {
            console.error(`Cloudflare RAG Error: ${response.statusText}`);
            return [];
        }

        const data = await response.json() as any;

        if (!data || !data.matches || data.matches.length === 0) {
            console.warn("No matches found in Cloudflare RAG.");
            return [];
        }

        return data.matches.map((match: any) => ({
            source: match.metadata?.source || 'Unknown',
            content: match.metadata?.text || '',
            score: match.score || 0
        }));

    } catch (error) {
        console.error("Error in retrieveDocuments:", error);
        return [];
    }
}

export async function retrieveContext(query: string, topK: number = 5): Promise<string> {
    const docs = await retrieveDocuments(query, topK);
    return docs.map(doc => `--- Source: ${doc.source} ---\n${doc.content}`).join('\n\n');
}

// Keep generateIndex as a no-op or remove it, but legal-qa-flow might not call it.
// Actually, legal-qa-flow only calls retrieveContext.
// But I should check if anything else calls generateIndex.
export async function generateIndex(): Promise<void> {
    console.log("Index generation is now handled by Cloudflare Worker ingestion script.");
}

