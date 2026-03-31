/**
 * Service wrapper for Resend API to send transactional emails.
 */
export class EmailService {
  constructor(private apiKey: string, private apiUrl: string = "https://api.resend.com/emails") {}

  /**
   * Sends an email via Resend.
   */
  async send(params: { to: string; subject: string; html: string; from?: string }) {
    const { to, subject, html, from = "Lawslane <contact@lawslane.com>" } = params;

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Resend API failed: ${errorText}`);
      throw new Error(`Resend Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }
}
