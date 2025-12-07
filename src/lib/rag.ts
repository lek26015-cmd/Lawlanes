import fs from 'fs';
import path from 'path';
import { ai } from '@/ai/genkit';
import { loadPdfDocuments } from './pdf-loader';

interface DocumentChunk {
    text: string;
    source: string;
    embedding: number[];
}

const INDEX_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'index.json');
const PDF_DIR_PATH = path.join(process.cwd(), 'src', 'data', 'pdfs');

// Helper to calculate cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Chunk text into smaller segments
function chunkText(text: string, source: string, chunkSize: number = 1000): { text: string; source: string }[] {
    const chunks: { text: string; source: string }[] = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
        let endIndex = currentIndex + chunkSize;
        if (endIndex < text.length) {
            // Try to find a sentence break or newline to avoid cutting words
            const lastPeriod = text.lastIndexOf('.', endIndex);
            const lastNewline = text.lastIndexOf('\n', endIndex);
            const breakPoint = Math.max(lastPeriod, lastNewline);

            if (breakPoint > currentIndex) {
                endIndex = breakPoint + 1;
            }
        }

        const chunk = text.slice(currentIndex, endIndex).trim();
        if (chunk.length > 0) {
            chunks.push({ text: chunk, source });
        }
        currentIndex = endIndex;
    }

    return chunks;
}

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateIndex(): Promise<void> {
    console.log('Starting index generation...');
    const documents = await loadPdfDocuments(PDF_DIR_PATH);
    const chunks: DocumentChunk[] = [];

    for (const doc of documents) {
        const textChunks = chunkText(doc.content, doc.source);
        console.log(`Processing ${doc.source}: ${textChunks.length} chunks`);

        for (const [index, chunk] of textChunks.entries()) {
            try {
                // Add delay to avoid hitting rate limits (e.g., 1 second between requests)
                await delay(1000);

                const response = await ai.embed({
                    embedder: 'googleai/text-embedding-004',
                    content: chunk.text,
                });
                const embedding = response[0].embedding;

                chunks.push({
                    text: chunk.text,
                    source: chunk.source,
                    embedding,
                });

                // Log progress every 5 chunks
                if ((index + 1) % 5 === 0) {
                    console.log(`  Processed ${index + 1}/${textChunks.length} chunks of ${doc.source}`);
                }
            } catch (error) {
                console.error(`Error embedding chunk from ${doc.source}:`, error);
                // Wait longer if error occurs (likely rate limit)
                await delay(5000);
            }
        }
    }

    fs.writeFileSync(INDEX_FILE_PATH, JSON.stringify(chunks, null, 2));
    console.log(`Index generated with ${chunks.length} chunks.`);
}

export async function retrieveContext(query: string, topK: number = 5): Promise<string> {
    try {
        // Check if index exists, if not generate it
        if (!fs.existsSync(INDEX_FILE_PATH)) {
            await generateIndex();
        }

        if (!fs.existsSync(INDEX_FILE_PATH)) {
            console.error("Index file still does not exist after generation attempt.");
            return "";
        }

        const indexData = fs.readFileSync(INDEX_FILE_PATH, 'utf-8');
        const chunks: DocumentChunk[] = JSON.parse(indexData);

        if (!chunks || chunks.length === 0) {
            console.warn("Index is empty.");
            return "";
        }

        // Embed the query
        console.log(`Embedding query: "${query}"`);
        const response = await ai.embed({
            embedder: 'googleai/text-embedding-004',
            content: query,
        });

        if (!response || !response[0] || !response[0].embedding) {
            console.error("Failed to generate embedding for query.");
            return "";
        }

        const queryEmbedding = response[0].embedding;

        // Calculate similarity for all chunks
        const scoredChunks = chunks.map(chunk => ({
            ...chunk,
            score: cosineSimilarity(queryEmbedding, chunk.embedding),
        }));

        // Sort by score descending
        scoredChunks.sort((a, b) => b.score - a.score);

        // Take top K
        const topChunks = scoredChunks.slice(0, topK);

        // Format context
        return topChunks.map(chunk => `--- Source: ${chunk.source} ---\n${chunk.text}`).join('\n\n');
    } catch (error) {
        console.error("Error in retrieveContext:", error);
        // Return empty string so the UI can handle it gracefully or show a generic message
        return "";
    }
}
