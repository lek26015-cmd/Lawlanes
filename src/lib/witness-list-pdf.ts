import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

export interface WitnessListPdfInput {
    caseTitle: string;
    lawyerName: string;
    evidence: { title: string; fact: string }[];
    witnesses: { name: string; role: string }[];
    signedAt: Date;
}

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Thai text has no spaces between words, so word-wrapping (split on ' ') doesn't work —
// wrap by measured character width instead. Not proper dictionary-based line breaking,
// but good enough for a real, readable legal document.
function wrapByWidth(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    let current = '';
    for (const ch of text) {
        const candidate = current + ch;
        if (font.widthOfTextAtSize(candidate, size) > maxWidth && current.length > 0) {
            lines.push(current);
            current = ch;
        } else {
            current = candidate;
        }
    }
    if (current) lines.push(current);
    return lines;
}

/**
 * สร้างไฟล์ "บัญชีระบุพยาน" จริงเป็น PDF (แทนที่ preview ปลอมที่เป็นแค่แถบสีเทาใน UI เดิม)
 * ใช้ฟอนต์ Sarabun ที่มีอยู่แล้วในโปรเจกต์ (`src/assets/fonts`) ผ่าน fontkit เพราะฟอนต์มาตรฐาน
 * ของ pdf-lib ไม่รองรับตัวอักษรไทย
 */
export async function generateWitnessListPdf(input: WitnessListPdfInput): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontsDir = path.join(process.cwd(), 'src/assets/fonts');
    const font = await pdfDoc.embedFont(fs.readFileSync(path.join(fontsDir, 'Sarabun-Regular.ttf')));
    const boldFont = await pdfDoc.embedFont(fs.readFileSync(path.join(fontsDir, 'Sarabun-Bold.ttf')));

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    const ensureSpace = (needed: number) => {
        if (y - needed < MARGIN) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            y = PAGE_HEIGHT - MARGIN;
        }
    };

    const drawParagraph = (text: string, opts: { size?: number; bold?: boolean; gap?: number; indent?: number } = {}) => {
        const size = opts.size ?? 12;
        const useFont = opts.bold ? boldFont : font;
        const indent = opts.indent ?? 0;
        const lines = wrapByWidth(text, useFont, size, CONTENT_WIDTH - indent);
        for (const line of lines) {
            ensureSpace(size + 6);
            page.drawText(line, { x: MARGIN + indent, y, size, font: useFont, color: rgb(0.1, 0.1, 0.12) });
            y -= size + 6;
        }
        y -= opts.gap ?? 4;
    };

    drawParagraph('บัญชีระบุพยาน', { size: 20, bold: true, gap: 2 });
    drawParagraph(`คดี: ${input.caseTitle}`, { size: 13, bold: true, gap: 8 });
    drawParagraph(
        `จัดทำวันที่ ${input.signedAt.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })} เวลา ${input.signedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`,
        { size: 10, gap: 16 }
    );

    drawParagraph('1. พยานเอกสาร/วัตถุพยาน', { size: 14, bold: true, gap: 8 });
    if (input.evidence.length === 0) {
        drawParagraph('— ไม่มีพยานเอกสารในบัญชีนี้ —', { size: 11, gap: 12 });
    } else {
        input.evidence.forEach((ev, idx) => {
            drawParagraph(`${idx + 1}. ${ev.title}`, { size: 12, bold: true, gap: 2 });
            drawParagraph(ev.fact || '(ไม่มีรายละเอียดเพิ่มเติม)', { size: 10.5, gap: 10, indent: 16 });
        });
    }

    y -= 8;
    drawParagraph('2. พยานบุคคล', { size: 14, bold: true, gap: 8 });
    if (input.witnesses.length === 0) {
        drawParagraph('— ไม่มีพยานบุคคลในบัญชีนี้ —', { size: 11, gap: 12 });
    } else {
        input.witnesses.forEach((wp, idx) => {
            drawParagraph(`${idx + 1}. ${wp.name} — ${wp.role}`, { size: 12, gap: 10 });
        });
    }

    y -= 24;
    ensureSpace(90);
    drawParagraph('ลงชื่อ ................................................... ทนายความผู้จัดทำบัญชีพยาน', { size: 11, gap: 4 });
    drawParagraph(`(${input.lawyerName})`, { size: 11, gap: 20, indent: 40 });
    drawParagraph(`ยืนยันตัวตนและจัดทำผ่านระบบ Lawslane เมื่อ ${input.signedAt.toLocaleString('th-TH')}`, { size: 9, gap: 0 });

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
}
