/**
 * Premium Email Templates for Lawslane
 * Optimized with Inline Styles for maximum compatibility across email clients (Gmail, Outlook, iOS).
 */

export function generateStandardEmailHtml(params: {
  title: string;
  content: string;
  buttonText?: string;
  buttonLink?: string;
}) {
  const { title, content, buttonText, buttonLink } = params;

  const buttonHtml = (buttonText && buttonLink) ? `
    <div style="text-align: center; margin: 36px 0 24px 0;">
      <a href="${buttonLink}" style="background-color: #0B3979; color: #ffffff !important; padding: 16px 36px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; display: inline-block;">${buttonText}</a>
      <p style="font-size: 13px; color: #94a3b8; margin-top: 24px; word-break: break-all;">
        หรือคลิกลิงก์นี้: <br><a href="${buttonLink}" style="color: #0B3979; text-decoration: none;">${buttonLink}</a>
      </p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f8fafc">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px;">
              <!-- Header -->
              <tr>
                <td align="center" style="padding-bottom: 32px;">
                  <div style="font-size: 28px; font-weight: 800; color: #0B3979; letter-spacing: -1px;">Lawslane</div>
                </td>
              </tr>
              <!-- Card -->
              <tr>
                <td bgcolor="#ffffff" style="background-color: #ffffff; border-radius: 24px; padding: 48px; border: 1px solid #e2e8f0;">
                  <h1 style="color: #0f172a; font-size: 24px; font-weight: 800; margin-top: 0; margin-bottom: 24px; text-align: center; line-height: 1.2;">
                    ${title}
                  </h1>
                  <div style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 24px; text-align: center;">
                    ${content}
                  </div>
                  ${buttonHtml}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td align="center" style="padding-top: 32px; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                  <p style="margin: 6px 0;">&copy; ${new Date().getFullYear()} Lawslane. All rights reserved.</p>
                  <p style="margin: 6px 0;">นี่คือการแจ้งเตือนอัตโนมัติ กรุณาอย่าตอบกลับอีเมลนี้</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
