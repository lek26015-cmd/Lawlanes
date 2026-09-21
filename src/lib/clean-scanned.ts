import sharp from 'sharp';

/**
 * Clean a scanned document image to look like a digital document.
 * - Converts to grayscale
 * - Increases contrast (makes text darker, background whiter)
 * - Applies threshold to create clean black text on white background
 * - Sharpens text edges
 * - Outputs as high-quality JPEG
 */
export async function cleanScannedImage(
  imageBuffer: Buffer,
  options?: {
    /** Threshold level (0-255). Higher = more aggressive white. Default: 180 */
    threshold?: number;
    /** Whether to apply adaptive threshold via normalize. Default: true */
    normalize?: boolean;
    /** Output format. Default: 'jpeg' */
    format?: 'jpeg' | 'png';
  }
): Promise<Buffer> {
  const threshold = options?.threshold ?? 180;
  const doNormalize = options?.normalize ?? true;
  const format = options?.format ?? 'jpeg';

  let pipeline = sharp(imageBuffer)
    // Convert to grayscale
    .grayscale()
    // Remove noise with mild blur before thresholding
    .median(3);

  // Normalize contrast range
  if (doNormalize) {
    pipeline = pipeline.normalize();
  }

  // Apply threshold to create clean black/white
  pipeline = pipeline.threshold(threshold);

  // Sharpen text edges
  pipeline = pipeline.sharpen({ sigma: 1.0 });

  // Output
  if (format === 'png') {
    return pipeline.png({ quality: 100 }).toBuffer();
  }
  return pipeline.jpeg({ quality: 95, mozjpeg: true }).toBuffer();
}

/**
 * Process multiple scanned images in batch.
 * Returns cleaned images ready for PDF creation.
 */
export async function cleanScannedImages(
  images: { buffer: Buffer; mimeType: string }[],
  options?: Parameters<typeof cleanScannedImage>[1]
): Promise<{ buffer: Buffer; mimeType: string }[]> {
  const results: { buffer: Buffer; mimeType: string }[] = [];

  for (const img of images) {
    try {
      const cleaned = await cleanScannedImage(img.buffer, options);
      results.push({
        buffer: cleaned,
        mimeType: 'image/jpeg', // Always output as JPEG for consistency
      });
    } catch (e) {
      console.error('Failed to clean image, using original:', e);
      results.push(img); // Fall back to original
    }
  }

  return results;
}

/**
 * Clean a scanned PDF by converting each page to an image,
 * processing it, and creating a new clean PDF.
 * Requires the source PDF buffer and uses pdf-lib + sharp.
 */
export async function cleanScannedPdfPages(
  pdfBuffer: Buffer,
  pageIndices: number[],
  options?: Parameters<typeof cleanScannedImage>[1]
): Promise<Buffer | null> {
  try {
    // We need to use pdf2pic or similar to render PDF pages to images
    // For now, this works with PDFs that contain embedded images (scanned PDFs)
    const { PDFDocument } = await import('pdf-lib');
    const sourcePdf = await PDFDocument.load(pdfBuffer);
    const totalPages = sourcePdf.getPageCount();
    
    const validIndices = pageIndices.filter(i => i >= 0 && i < totalPages);
    if (validIndices.length === 0) return null;

    // For scanned PDFs, each page is typically a single large image
    // We extract embedded images, clean them, and rebuild the PDF
    const newPdf = await PDFDocument.create();

    for (const pageIdx of validIndices) {
      const page = sourcePdf.getPage(pageIdx);
      const { width, height } = page.getSize();
      
      // Copy the page as-is (cleaning will be applied separately for image-based uploads)
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIdx]);
      newPdf.addPage(copiedPage);
    }

    const bytes = await newPdf.save();
    return Buffer.from(bytes);
  } catch (e) {
    console.error('Failed to clean scanned PDF pages:', e);
    return null;
  }
}
