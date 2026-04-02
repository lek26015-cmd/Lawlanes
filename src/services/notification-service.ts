/**
 * Notification Service for Lawslane (Next.js side)
 * This service triggers asynchronous background jobs via Cloudflare Queues.
 * Falls back to direct Resend API call in development if Cloudflare is not configured.
 */

import { pushToNotificationQueue } from "@/lib/queue-publisher";
import { generateStandardEmailHtml } from "@/lib/email-templates";
import { Resend } from "resend";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lawslane.com';
const ADMIN_EMAILS = ["contact@lawslane.com", "lek.26015@gmail.com"];

/**
 * Checks if Cloudflare Queue is properly configured.
 */
function isCloudflareConfigured() {
  return !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) || 
         !!(process.env.NOTIFICATION_QUEUE || (globalThis as any).NOTIFICATION_QUEUE);
}

/**
 * Helper to send email either via Queue (Prod) or Direct (Dev fallback).
 */
async function sendEmailFlexible(to: string, subject: string, html: string) {
  if (isCloudflareConfigured()) {
    return await pushToNotificationQueue({
      type: "EMAIL",
      data: { to, subject, html }
    });
  } else if (process.env.RESEND_API_KEY) {
    console.log(`[NotificationService] Dev/Fallback Mode: Sending email directly to ${to}`);
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      const { data, error } = await resend.emails.send({
        from: "Lawslane <contact@lawslane.com>",
        to,
        subject,
        html,
      });
      if (error) {
        console.error("❌ NotificationService: Resend Direct Send Error:", error);
        return { success: false, error: error.message };
      }
      console.log(`✅ NotificationService: Email sent successfully! (ID: ${data?.id})`);
      return { success: true, method: "direct", id: data?.id };
    } catch (err: any) {
      console.error("Direct Resend Exception:", err);
      return { success: false, error: err.message };
    }
  } else {
    console.warn("[NotificationService] No notification method configured (Missing Cloudflare or Resend keys)");
    return { success: false, error: "Missing configuration" };
  }
}

export const NotificationService = {
  /**
   * Trigger 1: Send a LINE notification to a specific lawyer for a new case.
   */
  async notifyLawyerNewCase(lawyerId: string, lawyerLineId: string, caseTitle: string) {
    console.log(`Queueing LINE notification for lawyer ${lawyerId}`);
    return await pushToNotificationQueue({
      type: "LINE_NOTIFICATION",
      to: lawyerLineId,
      text: `🔔 มีเคสใหม่รอท่านอยู่: "${caseTitle}"\nกรุณาเข้าสู่ระบบเพื่อตรวจสอบรายละเอียดค่ะ`,
    });
  },

  /**
   * Trigger 2: Send a LINE and Email notification to admins when a new lawyer registers.
   */
  async notifyAdminNewLawyer(lawyerName: string, lawyerEmail?: string) {
    console.log(`Queueing notifications for new lawyer registration: ${lawyerName}`);
    
    // 1. LINE Notification (Admin Group)
    await pushToNotificationQueue({
      type: "LINE_NOTIFICATION",
      text: `⚖️ มีทนายความใหม่ลงทะเบียน: "${lawyerName}"${lawyerEmail ? ` (${lawyerEmail})` : ''}\nกรุณาตรวจสอบและอนุมัติในระบบหลังบ้านค่ะ`,
    });

    // 2. Email Notification to Admins
    const emailHtml = generateStandardEmailHtml({
      title: "มีทนายความใหม่ลงทะเบียนในระบบ",
      content: `เรียนทีมแอดมิน,<br><br>มีทนายความใหม่ชื่อ <span class="highlight">${lawyerName}</span> ${lawyerEmail ? `(${lawyerEmail}) ` : ''}ได้ลงทะเบียนเข้าสู่ระบบ Lawslane เรียบร้อยแล้ว<br><br>กรุณาเข้าสู่ระบบจัดการเพื่อตรวจสอบเอกสารและอนุมัติการใช้งาน`,
      buttonText: "ดูรายชื่อทนายความ",
      buttonLink: `${SITE_URL}/admin/lawyers`
    });

    const results = await Promise.all(
      ADMIN_EMAILS.map(email => sendEmailFlexible(email, `[Lawslane Admin] มีทนายความใหม่สมัครสมาชิก: ${lawyerName}`, emailHtml))
    );

    return { success: results.every(r => r.success) };
  },

  /**
   * Trigger 3: Send a LINE and Email notification to admins for a new helpdesk ticket.
   */
  async notifyAdminNewTicket(ticketId: string, subject: string) {
    console.log(`Queueing notifications for new ticket: ${ticketId}`);
    
    // 1. LINE Notification
    await pushToNotificationQueue({
      type: "LINE_NOTIFICATION",
      text: `🆘 มีตั๋วความช่วยเหลือใหม่ (Ticket #${ticketId}): "${subject}"\nกรุณาตรวจสอบในระบบแอดมินค่ะ`,
    });

    // 2. Email Notification to Admins
    const emailHtml = generateStandardEmailHtml({
      title: "มีรายการตั๋วความช่วยเหลือใหม่",
      content: `เรียนทีมแอดมิน,<br><br>มีตั๋วความช่วยเหลือใหม่เข้าสู่ระบบ (Ticket #${ticketId})<br><br><span class="highlight">หัวข้อ:</span> ${subject}`,
      buttonText: "ดูรายการตั๋ว",
      buttonLink: `${SITE_URL}/admin/tickets`
    });

    const results = await Promise.all(
      ADMIN_EMAILS.map(email => sendEmailFlexible(email, `[Lawslane Helpdesk] ตั๋วใหม่ #${ticketId}: ${subject}`, emailHtml))
    );

    return { success: results.every(r => r.success) };
  },

  /**
   * Trigger 4: Send an Email/LINE notification to a lawyer for a new chat message.
   */
  async notifyLawyerNewChat(params: {
    lawyerId: string;
    lawyerName: string;
    lawyerEmail: string;
    lawyerLineId?: string;
    clientName: string;
    messageSnippet: string;
    chatId: string;
  }) {
    const { lawyerName, lawyerEmail, lawyerLineId, clientName, messageSnippet, chatId } = params;
    console.log(`Queueing chat notifications for lawyer ${params.lawyerId}`);

    // 1. Email Notification
    const emailHtml = generateStandardEmailHtml({
      title: "ท่านมีข้อความใหม่จากลูกความ",
      content: `เรียนทนายความ <span class="highlight">${lawyerName}</span>,<br><br>ท่านได้รับข้อความใหม่จากคุณ <span class="highlight">${clientName}</span>:<br><br><i>"${messageSnippet}"</i>`,
      buttonText: "ตอบแชททันที",
      buttonLink: `${SITE_URL}/chat/${chatId}?view=lawyer`
    });

    const emailRes = await sendEmailFlexible(lawyerEmail, `[Lawslane] ข้อความใหม่จากคุณ ${clientName}`, emailHtml);

    // 2. LINE Notification (if available)
    let lineRes = { success: true };
    if (lawyerLineId) {
      lineRes = await pushToNotificationQueue({
        type: "LINE_NOTIFICATION",
        to: lawyerLineId,
        text: `💬 ท่านมีข้อความใหม่จากคุณ ${clientName}: "${messageSnippet.substring(0, 30)}${messageSnippet.length > 30 ? '...' : ''}"\nคลิกเพื่อตอบแชท: ${SITE_URL}/chat/${chatId}?view=lawyer`,
      });
    }

    return { success: emailRes.success && lineRes.success };
  },

  /**
   * Trigger 5: Send an Email notification to a client for a new chat message from lawyer.
   */
  async notifyClientNewChat(params: {
    clientId: string;
    clientName: string;
    clientEmail: string;
    lawyerName: string;
    messageSnippet: string;
    chatId: string;
  }) {
    const { clientName, clientEmail, lawyerName, messageSnippet, chatId } = params;
    console.log(`Queueing chat notifications for client ${params.clientId}`);

    const emailHtml = generateStandardEmailHtml({
      title: "ท่านมีข้อความใหม่จากทนายความ",
      content: `เรียนคุณ <span class="highlight">${clientName}</span>,<br><br>ท่านได้รับข้อความใหม่จากทนายความ <span class="highlight">${lawyerName}</span>:<br><br><i>"${messageSnippet}"</i>`,
      buttonText: "อ่านข้อความเบื้องต้น",
      buttonLink: `${SITE_URL}/chat/${chatId}`
    });

    return await sendEmailFlexible(clientEmail, `[Lawslane] ข้อความใหม่จากทนายความ ${lawyerName}`, emailHtml);
  },

  /**
   * Trigger 6: Send an Email notification to a client when a lawyer requests a fee to open a case.
   */
  async notifyClientFeeRequested(params: {
    clientName: string;
    clientEmail: string;
    lawyerName: string;
    amount: number;
    reason?: string;
    chatId: string;
  }) {
    const { clientName, clientEmail, lawyerName, amount, reason, chatId } = params;
    console.log(`Queueing fee request notifications for client`);

    const emailHtml = generateStandardEmailHtml({
      title: "ท่านได้รับข้อเสนอราคาเพื่อเริ่มงาน (เปิดคดี)",
      content: `เรียนคุณ <span class="highlight">${clientName}</span>,<br><br>ทนายความ <span class="highlight">${lawyerName}</span> ได้ส่งข้อเสนอราคาเพื่อเริ่มต้นดำเนินการทางกฎหมายให้ท่านอย่างเป็นทางการ:<br><br><span class="highlight">เหตุผล/ขอบเขต:</span> ${reason || "ตามที่ตกลงในแชท"}<br><span class="highlight">ยอดชำระ:</span> ฿${amount.toLocaleString()}<br><br>ท่านสามารถชำระเงินผ่านระบบ Lawlane เพื่อให้เงินของท่านได้รับความคุ้มครองอย่างปลอดภัย และเริ่มงานได้ทันทีค่ะ`,
      buttonText: "ดูข้อเสนอและชำระเงิน",
      buttonLink: `${SITE_URL}/chat/${chatId}`
    });

    return await sendEmailFlexible(clientEmail, `[Lawslane] ข้อเสนอราคาเปิดคดีจากทนายความ ${lawyerName}`, emailHtml);
  },


  /**
   * General Email Trigger
   */
  async sendEmail(to: string, subject: string, html: string) {
    console.log(`Queueing Email for ${to}`);
    return await sendEmailFlexible(to, subject, html);
  },
};
