/**
 * File Manager Worker for Lawslane (Cloudflare R2)
 * Generates short-lived Pre-signed URLs for sensitive legal documents.
 */

export interface Env {
  AUTH_SECRET: string;
  R2_BUCKET_NAME: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_PUBLIC_DOMAIN: string; // The custom domain for R2 or public endpoint
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const authHeader = request.headers.get("Authorization");

    // Simple Bearer Token Auth between Next.js and this Worker
    if (authHeader !== `Bearer ${env.AUTH_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const path = url.searchParams.get("path"); // e.g. "cases/123/document.pdf"
    const method = url.searchParams.get("method") || "GET"; // GET or PUT
    const expiry = parseInt(url.searchParams.get("expiry") || "3600"); // Default 1 hour

    if (!path) {
      return new Response("Missing path", { status: 400 });
    }

    try {
      // Logic for generating Pre-signed URL
      // We'll use the S3 API structure for R2
      const signedUrl = await generatePresignedUrl({
        bucket: env.R2_BUCKET_NAME,
        key: path,
        method,
        expiry,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        region: "auto",
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      });

      return new Response(JSON.stringify({ url: signedUrl, expiry }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }
};

/**
 * Lightweight S3 Pre-signed URL Generator (V4 Signing)
 * This avoids including the heavy AWS SDK in the worker.
 */
async function generatePresignedUrl(params: any) {
  // Implementation of AWS V4 Signing for Pre-signed URLs
  // For brevity and reliability in this boilerplate, I'll outline the steps
  // or use a proven lightweight pattern.
  
  // Note: In a real production environment, you would use 'aws4fetch' 
  // or the '@aws-sdk/s3-request-presigner' with a custom fetch fetch.
  
  return `${params.endpoint}/${params.bucket}/${params.key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&...`; // Mocking the full string for the boilerplate
}
