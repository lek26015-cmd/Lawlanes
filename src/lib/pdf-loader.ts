import fs from 'fs';
import path from 'path';
const pdf = require('pdf-parse');

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
                const data = await pdf(dataBuffer);
                const fileName = path.basename(filePath);

                allText += `\n\n--- Document: ${fileName} ---\n\n`;
                allText += data.text;
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
                const data = await pdf(dataBuffer);
                const fileName = path.basename(filePath);

                documents.push({
                    source: fileName,
                    content: data.text
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
