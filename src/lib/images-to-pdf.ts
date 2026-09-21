import { PDFDocument, PDFImage, rgb } from 'pdf-lib';

/**
 * Convert an array of image buffers into a single PDF.
 * Each image becomes one full-page in the PDF.
 * Optionally erase header/footer by drawing white rectangles over them.
 */
export async function imagesToPdf(
  images: { buffer: Buffer; mimeType: string }[],
  options?: { cropTopPercent?: number; cropBottomPercent?: number }
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  for (const img of images) {
    let pdfImage: PDFImage;

    if (img.mimeType === 'image/png') {
      pdfImage = await pdfDoc.embedPng(img.buffer);
    } else {
      // JPG/JPEG and other formats → treat as JPEG
      pdfImage = await pdfDoc.embedJpg(img.buffer);
    }

    // Create page matching image aspect ratio (fit to A4 width)
    const A4_WIDTH = 595.28; // points (72 dpi)
    const scale = A4_WIDTH / pdfImage.width;
    const pageWidth = A4_WIDTH;
    const pageHeight = pdfImage.height * scale;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(pdfImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    // Erase header/footer with white rectangles
    if (options?.cropTopPercent) {
      const topH = pageHeight * options.cropTopPercent;
      page.drawRectangle({
        x: 0, y: pageHeight - topH,
        width: pageWidth, height: topH,
        color: rgb(1, 1, 1),
      });
    }
    if (options?.cropBottomPercent) {
      const bottomH = pageHeight * options.cropBottomPercent;
      page.drawRectangle({
        x: 0, y: 0,
        width: pageWidth, height: bottomH,
        color: rgb(1, 1, 1),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Extract a subset of images by page range and create a PDF.
 * Pages are 1-indexed: [startPage, endPage] inclusive.
 */
export async function pageRangeToPdf(
  allImages: { buffer: Buffer; mimeType: string }[],
  startPage: number,
  endPage: number
): Promise<Buffer> {
  const subset = allImages.slice(startPage - 1, endPage);
  return imagesToPdf(subset);
}

/**
 * Split an existing PDF by page range.
 * Pages are 1-indexed: [startPage, endPage] inclusive.
 */
export async function splitPdfByPageRange(
  pdfBuffer: Buffer,
  startPage: number,
  endPage: number
): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const newDoc = await PDFDocument.create();

  // Convert 1-indexed to 0-indexed
  const startIdx = Math.max(0, startPage - 1);
  const endIdx = Math.min(srcDoc.getPageCount() - 1, endPage - 1);

  const pageIndices = [];
  for (let i = startIdx; i <= endIdx; i++) {
    pageIndices.push(i);
  }

  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  const pdfBytes = await newDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Get total page count of a PDF.
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(pdfBuffer);
  return doc.getPageCount();
}
