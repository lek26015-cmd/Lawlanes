import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// const pdfRequire = require('pdf-parse'); // Lazy load instead
import { callTyphoonOCR } from './typhoon';

function getAllPdfFiles(dirPath: string, arrayOfFiles: string[] = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(function (file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllPdfFiles(fullPath, arrayOfFiles);
        } else {
            if (file.toLowerCase().endsWith('.pdf')) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

export async function loadPdfsFromDirectory(directoryPath: string): Promise<string> {
    try {
        if (!fs.existsSync(directoryPath)) {
            console.warn(`Directory not found: ${directoryPath}`);
            return '';
        }

        const pdfFiles = getAllPdfFiles(directoryPath);
        let allText = '';

        for (const filePath of pdfFiles) {
            try {
                const dataBuffer = fs.readFileSync(filePath);
                const pdfRequire = require('pdf-parse');
                // @ts-ignore
                const parser = new pdfRequire.PDFParse(new Uint8Array(dataBuffer));
                // @ts-ignore
                const data = await parser.getText();
                const fileName = path.basename(filePath);

                allText += `\n\n--- Document: ${fileName} ---\n\n`;
                allText += data?.text || '';
            } catch (err) {
                console.error(`Error parsing file ${filePath}:`, err);
            }
        }

        return allText;
    } catch (error) {
        console.error('Error loading PDFs:', error);
        return '';
    }
}

export interface PdfDocument {
    source: string;
    content: string;
}

export async function parsePdfFromBuffer(buffer: Buffer): Promise<string> {
    try {
        const pdfRequire = require('pdf-parse');
        // @ts-ignore
        const parser = new pdfRequire.PDFParse(new Uint8Array(buffer));
        // @ts-ignore
        const data = await parser.getText();
        let text = data?.text || '';

        // Check for "Mojibake" (garbled text) or empty content
        // Heuristic: If text length > 50 but Thai character ratio is very low (< 5%), it's likely garbage encoding.
        // Valid Thai PDF should have a good mix of Thai chars.
        const totalChars = text.length;
        const thaiChars = text.match(/[\u0E00-\u0E7F]/g)?.length || 0;
        const thaiRatio = totalChars > 0 ? thaiChars / totalChars : 0;

        const isGarbage = totalChars > 50 && thaiRatio < 0.05;
        const isTooShort = text.trim().length < 50;

        if (isTooShort || isGarbage) {
            console.log(`Text extraction problematic (Length: ${totalChars}, Thai Ratio: ${thaiRatio.toFixed(2)}). Attempting Typhoon OCR...`);
            const ocrText = await callTyphoonOCR(buffer);
            if (ocrText && ocrText.length > 50) {
                console.log("Typhoon OCR successful.");
                text = ocrText;
            } else {
                console.warn("Typhoon OCR failed or returned empty.");
            }
        }

        return text;
    } catch (error) {
        console.error('Error parsing PDF buffer:', error);
        return '';
    }
}

export async function loadPdfDocuments(directoryPath: string): Promise<PdfDocument[]> {
    try {
        if (!fs.existsSync(directoryPath)) {
            console.warn(`Directory not found: ${directoryPath}`);
            return [];
        }

        const pdfFiles = getAllPdfFiles(directoryPath);
        const documents: PdfDocument[] = [];

        for (const filePath of pdfFiles) {
            try {
                const dataBuffer = fs.readFileSync(filePath);
                const content = await parsePdfFromBuffer(dataBuffer);
                const fileName = path.basename(filePath);

                documents.push({
                    source: fileName,
                    content
                });
            } catch (err) {
                console.error(`Error parsing file ${filePath}:`, err);
            }
        }

        return documents;
    } catch (error) {
        console.error('Error loading PDFs:', error);
        return [];
    }
}
