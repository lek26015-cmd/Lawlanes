import puppeteer from "@cloudflare/puppeteer";
import { getInvoiceHtml } from "./template";

export interface Env {
  BROWSER: any; // Cloudflare Browser Rendering binding
  INVOICE_BUCKET: R2Bucket;
  AUTH_SECRET: string;
}

/**
 * LawsLane PDF Invoice Generator Worker
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${env.AUTH_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const data = await request.json() as any;
      const html = getInvoiceHtml(data);
      const filename = `invoice-${data.invoiceNumber}-${Date.now()}.pdf`;

      // 1. Launch Browser via Cloudflare Rendering API
      const browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();

      // 2. Set content and generate PDF
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" }
      });

      await browser.close();

      // 3. Save to R2
      await env.INVOICE_BUCKET.put(filename, pdfBuffer, {
        httpMetadata: { contentType: "application/pdf" }
      });

      // 4. In a real scenario, you would generate a pre-signed URL. 
      // For this worker, we return the filename. The frontend can then 
      // use the previously implemented 'file-manager' to get a signed link.
      
      return new Response(JSON.stringify({ 
        success: true, 
        filename,
        message: "Invoice generated and stored in R2"
      }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (err: any) {
      console.error("PDF Generation Error:", err.message);
      return new Response(JSON.stringify({ error: "Failed to generate PDF", details: err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
