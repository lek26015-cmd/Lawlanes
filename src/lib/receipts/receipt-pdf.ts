import { PDFDocument, PDFFont, PDFPage, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

/** ข้อมูลที่ใช้วาดใบเสร็จ — แปลงจากเอกสาร receipts แล้ว (วันที่เป็น Date) */
export interface ReceiptPdfInput {
    receiptNo: string;
    status: 'issued' | 'void';
    voidReason?: string;
    issuer: { name: string; address: string | null; taxId: string | null; licenseNumber: string | null };
    payer: { name: string | null; address: string | null };
    caseTitle: string | null;
    items: { description: string; amount: number }[];
    amount: number;
    amountText: string;
    paymentMethod: string | null;
    paidAt: Date;
    issuedAt: Date;
}

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);

// สระบน/ล่าง วรรณยุกต์ ไม้ไต่คู้ การันต์ — ต้องติดอยู่กับพยัญชนะตัวหน้า ห้ามตัดบรรทัดคั่น
const THAI_COMBINING = /[ัิ-ฺ็-๎]/;

function graphemes(text: string): string[] {
    const out: string[] = [];
    for (const ch of text) {
        if (THAI_COMBINING.test(ch) && out.length > 0) out[out.length - 1] += ch;
        else out.push(ch);
    }
    return out;
}

/** ไทยไม่มีช่องว่างระหว่างคำ → ตัดบรรทัดตามความกว้างจริง (ไม่ตัดกลางสระ/วรรณยุกต์) */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
        let current = '';
        for (const g of graphemes(paragraph)) {
            const candidate = current + g;
            if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
                // ตัดที่ช่องว่างล่าสุดถ้ามี (ที่อยู่ไทยเว้นวรรคระหว่างส่วน) ไม่งั้นค่อยตัดกลางคำ
                const lastSpace = current.lastIndexOf(' ');
                if (lastSpace > 0) {
                    lines.push(current.slice(0, lastSpace));
                    current = (current.slice(lastSpace + 1) + g).trimStart();
                } else {
                    lines.push(current);
                    current = g.trimStart();
                }
            } else {
                current = candidate;
            }
        }
        lines.push(current);
    }
    return lines;
}

const thDate = (d: Date) =>
    d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
const money = (n: number) =>
    n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function generateReceiptPdf(input: ReceiptPdfInput): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    doc.setTitle(`ใบเสร็จรับเงิน ${input.receiptNo}`);
    doc.setAuthor(input.issuer.name);
    doc.setCreator('Lawslane');

    const fontsDir = path.join(process.cwd(), 'src/assets/fonts');
    const font = await doc.embedFont(fs.readFileSync(path.join(fontsDir, 'Sarabun-Regular.ttf')), { subset: true });
    const bold = await doc.embedFont(fs.readFileSync(path.join(fontsDir, 'Sarabun-Bold.ttf')), { subset: true });

    const page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    const text = (s: string, x: number, yy: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}) =>
        page.drawText(s, { x, y: yy, size: opts.size ?? 11, font: opts.bold ? bold : font, color: opts.color ?? INK });
    const rightText = (s: string, rightX: number, yy: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
        const f = opts.bold ? bold : font;
        const w = f.widthOfTextAtSize(s, opts.size ?? 11);
        text(s, rightX - w, yy, opts);
    };
    const para = (s: string, x: number, width: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
        const size = opts.size ?? 11;
        for (const line of wrap(s, opts.bold ? bold : font, size, width)) {
            text(line, x, y, opts);
            y -= size + 5;
        }
    };
    const hr = () => {
        page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.8, color: LINE });
    };

    // ── หัวเอกสาร ──
    text('ใบเสร็จรับเงิน', MARGIN, y - 6, { size: 24, bold: true });
    text('RECEIPT', MARGIN, y - 26, { size: 11, color: MUTED });
    rightText(`เลขที่ ${input.receiptNo}`, PAGE_WIDTH - MARGIN, y - 4, { size: 12, bold: true });
    rightText(`วันที่ ${thDate(input.issuedAt)}`, PAGE_WIDTH - MARGIN, y - 22, { size: 11 });
    y -= 50;
    hr();
    y -= 22;
    if (input.status === 'void') {
        para(`ใบเสร็จนี้ถูกยกเลิก${input.voidReason ? ` — ${input.voidReason}` : ''}`, MARGIN, CONTENT_WIDTH, { size: 11, bold: true, color: rgb(0.75, 0.1, 0.1) });
        y -= 10;
    }

    // ── ผู้รับเงิน / ผู้จ่าย (สองคอลัมน์) ──
    const colGap = 24;
    const colW = (CONTENT_WIDTH - colGap) / 2;
    const top = y;

    text('ผู้รับเงิน', MARGIN, y, { size: 10, bold: true, color: MUTED });
    y -= 17;
    para(input.issuer.name, MARGIN, colW, { size: 12, bold: true });
    if (input.issuer.address) para(input.issuer.address, MARGIN, colW, { size: 10 });
    if (input.issuer.taxId) para(`เลขประจำตัวผู้เสียภาษี ${input.issuer.taxId}`, MARGIN, colW, { size: 10 });
    if (input.issuer.licenseNumber) para(`ใบอนุญาตว่าความเลขที่ ${input.issuer.licenseNumber}`, MARGIN, colW, { size: 10 });
    const leftBottom = y;

    y = top;
    const rx = MARGIN + colW + colGap;
    text('ได้รับเงินจาก', rx, y, { size: 10, bold: true, color: MUTED });
    y -= 17;
    para(input.payer.name || '—', rx, colW, { size: 12, bold: true });
    if (input.payer.address) para(input.payer.address, rx, colW, { size: 10 });
    y = Math.min(y, leftBottom) - 14;

    if (input.caseTitle) {
        para(`อ้างอิงเคส: ${input.caseTitle}`, MARGIN, CONTENT_WIDTH, { size: 10, color: MUTED });
        y -= 4;
    }

    // ── ตารางรายการ ──
    const amountColRight = PAGE_WIDTH - MARGIN - 10;
    page.drawRectangle({ x: MARGIN, y: y - 8, width: CONTENT_WIDTH, height: 24, color: rgb(0.95, 0.96, 0.98) });
    text('ลำดับ', MARGIN + 10, y, { size: 10, bold: true });
    text('รายการ', MARGIN + 60, y, { size: 10, bold: true });
    rightText('จำนวนเงิน (บาท)', amountColRight, y, { size: 10, bold: true });
    y -= 30;

    input.items.forEach((item, i) => {
        const rowTop = y;
        text(String(i + 1), MARGIN + 10, y, { size: 11 });
        rightText(money(item.amount), amountColRight, y, { size: 11 });
        para(item.description, MARGIN + 60, CONTENT_WIDTH - 60 - 130, { size: 11 });
        y = Math.min(y, rowTop - 16) - 6;
    });
    hr();
    y -= 22;

    text('รวมทั้งสิ้น', PAGE_WIDTH - MARGIN - 230, y, { size: 12, bold: true });
    rightText(money(input.amount), amountColRight, y, { size: 14, bold: true });
    y -= 20;
    rightText(`(${input.amountText})`, amountColRight, y, { size: 11 });
    y -= 30;

    // ── การชำระเงิน ──
    para(`วันที่รับเงิน: ${thDate(input.paidAt)}`, MARGIN, CONTENT_WIDTH, { size: 11 });
    if (input.paymentMethod) para(`ชำระโดย: ${input.paymentMethod}`, MARGIN, CONTENT_WIDTH, { size: 11 });
    y -= 30;

    // ── ลงนามผู้รับเงิน (ยืนยันผ่านระบบ ไม่มีลายมือชื่อจริง) ──
    const signX = PAGE_WIDTH - MARGIN - 220;
    page.drawLine({ start: { x: signX, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.6, color: MUTED });
    y -= 16;
    const signCenter = signX + 110;
    const signLabel = `(${input.issuer.name})`;
    text(signLabel, signCenter - font.widthOfTextAtSize(signLabel, 10) / 2, y, { size: 10 });
    y -= 14;
    const signNote = 'ผู้รับเงิน — ยืนยันการรับเงินผ่านระบบ';
    text(signNote, signCenter - font.widthOfTextAtSize(signNote, 9) / 2, y, { size: 9, color: MUTED });

    // ── หมายเหตุท้ายกระดาษ ──
    y = MARGIN + 40;
    page.drawLine({ start: { x: MARGIN, y: y + 16 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 16 }, thickness: 0.5, color: LINE });
    para('เอกสารนี้ไม่ใช่ใบกำกับภาษี', MARGIN, CONTENT_WIDTH, { size: 9, bold: true, color: MUTED });
    para(
        'ออกโดยระบบ Lawslane ในนามของผู้รับเงินข้างต้น หลังผู้รับเงินยืนยันว่าได้รับเงินแล้ว — Lawslane ไม่ได้เป็นผู้รับหรือถือเงินค่าบริการนี้',
        MARGIN, CONTENT_WIDTH, { size: 9, color: MUTED },
    );

    // ── ใบที่ยกเลิก ──
    if (input.status === 'void') {
        const label = 'ยกเลิก';
        const size = 110;
        page.drawText(label, {
            x: PAGE_WIDTH / 2 - bold.widthOfTextAtSize(label, size) / 2 + 40,
            y: PAGE_HEIGHT / 2 - 120,
            size,
            font: bold,
            color: rgb(0.85, 0.15, 0.15),
            opacity: 0.18,
            rotate: degrees(30),
        });
    }

    return doc.save();
}
