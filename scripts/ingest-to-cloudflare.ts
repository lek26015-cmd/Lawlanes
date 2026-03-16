import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const WORKER_URL = 'https://lawslane-rag-api.lawlanes-app.workers.dev';
const LOCAL_API_URL = 'http://localhost:9002/api/admin/ingestion-status';
const PDF_DIR = path.join(process.cwd(), 'src/data/pdfs');
const DELAY_BETWEEN_CHUNKS = 500; // ms

async function updateLocalStatus(status: 'active' | 'cooling_down' | 'idle' | 'error', message: string = "", nextRetry: string = "") {
    try {
        await fetch(LOCAL_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: 'pdf_ingestor', status, message, nextRetry })
        });
    } catch (e) {
        // Ignore if dev server is down
    }
}

async function loadPdf(filePath: string): Promise<string> {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const parser = new PDFParse(new Uint8Array(dataBuffer));
        const data = await parser.getText();
        return data?.text || (typeof data === 'string' ? data : '');
    } catch (error) {
        console.error(`Error parsing ${filePath}:`, error);
        return '';
    }
}

function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += chunkSize - overlap;
    }
    return chunks;
}

async function ingestChunk(text: string, metadata: any) {
    const maxRetries = 10;
    const baseWait = 2000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            await updateLocalStatus('active', `Ingesting ${metadata.source} (chunk ${metadata.chunkIndex})`);
            
            const response = await fetch(`${WORKER_URL}/ingest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Lawslane-Ingestor/1.1'
                },
                body: JSON.stringify({ text, metadata, id: metadata.id })
            });

            if (response.status === 429) {
                const waitTime = baseWait * Math.pow(2, attempt);
                console.log(`    ⚠️ Rate limited (429). Retrying in ${waitTime}ms... (Attempt ${attempt + 1}/${maxRetries})`);
                await updateLocalStatus('cooling_down', `Rate limited. Waiting ${waitTime}ms`, `${waitTime}ms`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`    ❌ Ingest failed: ${response.status} ${response.statusText} - ${errorText}`);
                if (response.status >= 500) {
                    const waitTime = baseWait * Math.pow(2, attempt);
                    await updateLocalStatus('cooling_down', `Server error ${response.status}`, `${waitTime}ms`);
                    await new Promise(r => setTimeout(r, waitTime));
                    continue;
                }
                await updateLocalStatus('error', `Fatal error: ${response.status}`);
                return null;
            }
            return await response.json();
        } catch (error) {
            const waitTime = baseWait * Math.pow(2, attempt);
            console.error(`    ❌ Ingest error: ${error}. Retrying in ${waitTime}ms...`);
            await updateLocalStatus('cooling_down', `Network error`, `${waitTime}ms`);
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
    console.error('    🚫 Max retries reached for this chunk. Stopping to prevent data loss.');
    await updateLocalStatus('error', 'Max retries reached. Stalled.');
    process.exit(1);
}

async function main() {
    console.log(`Scanning PDFs in ${PDF_DIR}...`);
    if (!fs.existsSync(PDF_DIR)) {
        console.error('PDF directory not found!');
        return;
    }

    const files = fs.readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
    console.log(`Found ${files.length} PDF files.`);

    for (const file of files) {
        console.log(`Processing ${file}...`);
        const filePath = path.join(PDF_DIR, file);
        const text = await loadPdf(filePath);

        if (!text) {
            console.warn(`Skipping empty file: ${file}`);
            continue;
        }

        const chunks = chunkText(text);
        console.log(`  - Generated ${chunks.length} chunks.`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const id = require('crypto').createHash('md5').update(`${file}-${i}`).digest('hex');

            await ingestChunk(chunk, {
                source: file,
                chunkIndex: i,
                totalChunks: chunks.length,
                text: chunk,
                id
            });
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_CHUNKS));
        }
        console.log(`  - Uploaded ${chunks.length} chunks.`);
    }
    console.log('Ingestion complete!');
    await updateLocalStatus('idle', 'All PDFs ingested successfully');
}

main();
