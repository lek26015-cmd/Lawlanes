import PostalMime from 'postal-mime';

export interface Env {
  INBOUND_EMAIL_SECRET: string;
  NEXT_PUBLIC_APP_URL: string; // e.g., https://lawslane.com
}

export default {
  /**
   * Cloudflare Email Routing Handler
   */
  async email(message: any, env: Env, ctx: any) {
    try {
      // 1. Parse the email
      const parser = new PostalMime();
      const email = await parser.parse(message.raw);

      // 2. Prepare payload for Next.js Webhook
      const payload = {
        from: message.from,
        to: message.to,
        subject: email.subject || "(No Subject)",
        text: email.text || "",
        html: email.html || "",
        date: email.date || new Date().toISOString(),
      };

      // 3. Post to Next.js API
      const response = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/webhooks/inbound-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-inbound-token": env.INBOUND_EMAIL_SECRET,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${await response.text()}`);
      }

      console.log(`Successfully forwarded inbound email from ${message.from} to webhook.`);
      
    } catch (error) {
      console.error("Inbound Email Worker Error:", error);
      // We don't want to bounce the email if the webhook fails, 
      // but we log it. In production, consider a fallback storage.
    }
  },
};
