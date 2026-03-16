
// Use environment variable with fallback to the known deployed URL
const WORKER_URL = process.env.NEXT_PUBLIC_RAG_WORKER_URL || 'https://lawslane-rag-api.lawlanes-app.workers.dev';

export async function retrieveDocuments(query: string, topK: number = 5): Promise<Array<{ source: string, content: string, score: number }>> {
    const MAX_RETRIES = 2;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
        try {
            console.log(`[RAG] Querying Cloudflare RAG for: "${query}" (Attempt ${attempt + 1})`);
            
            // Added timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(`${WORKER_URL}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: query }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Cannot read error text');
                console.error(`[RAG] Error Response: ${response.status} ${response.statusText}`, errorText);
                throw new Error(`Worker returned ${response.status}`);
            }

            const data = await response.json() as any;

            if (!data || !data.matches || data.matches.length === 0) {
                console.warn("[RAG] No matches found in Cloudflare RAG.");
                return [];
            }

            return data.matches.map((match: any) => {
                let content = match.metadata?.text || '';
                
                // --- Simple Thai Text Repair ---
                // 1. Remove "Tofu" / Box characters that come from PDF extraction
                content = content.replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
                content = content.replace(/□/g, '');
                
                // 2. Clean up excessive whitespace/newlines
                content = content.replace(/\n\s*\n/g, '\n').trim();

                return {
                    source: match.metadata?.source || 'Unknown',
                    content: content,
                    score: match.score || 0
                };
            });

        } catch (error) {
            attempt++;
            
            const isTimeout = error instanceof Error && error.name === 'AbortError';
            const errorMsg = isTimeout ? 'Request timeout' : (error instanceof Error ? error.message : String(error));
            
            console.error(`[RAG] Error in retrieveDocuments (URL: ${WORKER_URL}):`, errorMsg);
            
            if (attempt > MAX_RETRIES) {
                console.error(`[RAG] Failed after ${MAX_RETRIES + 1} attempts. Returning empty results.`);
                return [];
            }
            
            // Wait before retrying (exponential backoff: 500ms, 1000ms)
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
    }
    
    return [];
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

