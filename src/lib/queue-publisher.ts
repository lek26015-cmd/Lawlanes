/**
 * Low-level publisher for Cloudflare Queues.
 */

export type NotificationPayload = 
  | { type: "EMAIL"; data: { to: string; subject: string; html: string; from?: string } }
  | { type: "LINE_NOTIFICATION"; to?: string; text: string };

/**
 * Pushes a notification task to the Cloudflare Queue.
 * 
 * If running on Cloudflare (Pages/Workers), uses the 'NOTIFICATION_QUEUE' binding.
 * Otherwise, falls back to the Cloudflare REST API.
 */
export async function pushToNotificationQueue(payload: NotificationPayload) {
  try {
    // 1. Try to use direct binding (Cloudflare Environment)
    // @ts-ignore - Binding available in Cloudflare runtime
    const queue = process.env.NOTIFICATION_QUEUE || (globalThis as any).NOTIFICATION_QUEUE;
    
    if (queue && typeof queue.send === "function") {
      await queue.send(payload);
      return { success: true, method: "binding" };
    }

    // 2. Fallback: Cloudflare REST API
    // Need Cloudflare Account ID, Queue Name, and API Token with Queue Send permissions
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const queueName = "lawslane-notification-queue";
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      console.error("Missing Cloudflare Queue credentials for REST fallback");
      return { success: false, error: "Missing config" };
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/queues/${queueName}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: payload }),
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudflare Queue REST Error: ${await response.text()}`);
    }

    return { success: true, method: "rest" };
  } catch (error) {
    console.error("Failed to push to notification queue:", error);
    // In production, you might want to log this to Sentry or a persistent log database
    return { success: false, error: (error as Error).message };
  }
}
