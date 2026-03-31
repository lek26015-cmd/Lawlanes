/**
 * Service wrapper for LINE Messaging API to send push notifications.
 */
export class LineService {
  constructor(private accessToken: string, private apiUrl: string = "https://api.line.me/v2/bot/message/push") {}

  /**
   * Sends a push message to a specific user or group ID.
   */
  async pushMessage(to: string, text: string) {
    if (!to) {
      console.warn("LINE Push: Missing 'to' recipient ID");
      return;
    }

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        messages: [
          {
            type: "text",
            text,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LINE API failed: ${errorText}`);
      throw new Error(`LINE Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }
}
