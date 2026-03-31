import { EmailService } from "./services/email-service";
import { LineService } from "./services/line-service";

/**
 * Message payload schema for the notification queue.
 */
export type NotificationMessage = 
  | { type: "EMAIL"; data: { to: string; subject: string; html: string; from?: string } }
  | { type: "LINE_NOTIFICATION"; to?: string; text: string };

export interface Env {
  // Environment variables (Boundaries)
  RESEND_API_KEY: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  ADMIN_LINE_ID: string;
}

export default {
  /**
   * Cloudflare Queue Consumer
   * This function is triggered automatically when messages are available in the queue.
   */
  async queue(batch: any, env: Env): Promise<void> {
    const emailService = new EmailService(env.RESEND_API_KEY);
    const lineService = new LineService(env.LINE_CHANNEL_ACCESS_TOKEN);

    for (const message of batch.messages) {
      const payload = message.body as NotificationMessage;
      console.log(`Processing notification: ${payload.type}`);

      try {
        switch (payload.type) {
          case "EMAIL":
            await emailService.send(payload.data);
            console.log(`Email sent to ${payload.data.to}`);
            break;

          case "LINE_NOTIFICATION":
            // Use provided 'to' or fallback to Admin LINE ID
            const recipient = payload.to || env.ADMIN_LINE_ID;
            await lineService.pushMessage(recipient, payload.text);
            console.log(`LINE notification sent to ${recipient}`);
            break;

          default:
            console.error(`Unknown notification type: ${(payload as any).type}`);
        }
        
        // Mark message as processed successfully
        message.ack();
      } catch (err) {
        console.error(`Failed to process message: ${err}`);
        // This will trigger a retry based on 'max_retries' in wrangler.toml
        message.retry();
      }
    }
  },
};
