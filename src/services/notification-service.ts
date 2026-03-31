/**
 * Notification Service for Lawslane (Next.js side)
 * This service triggers asynchronous background jobs via Cloudflare Queues.
 */

import { pushToNotificationQueue } from "@/lib/queue-publisher";

export const NotificationService = {
  /**
   * Trigger 1: Send a LINE notification to a specific lawyer for a new case.
   */
  async notifyLawyerNewCase(lawyerId: string, lawyerLineId: string, caseTitle: string) {
    console.log(`Queueing LINE notification for lawyer ${lawyerId}`);
    return await pushToNotificationQueue({
      type: "LINE_NOTIFICATION",
      to: lawyerLineId,
      text: `🔔 มีเคสใหม่รอคุณอยู่: "${caseTitle}"\nกรุณาเข้าสู่ระบบเพื่อตรวจสอบรายละเอียดค่ะ`,
    });
  },

  /**
   * Trigger 2: Send a LINE notification to admins when a new lawyer registers.
   */
  async notifyAdminNewLawyer(lawyerName: string) {
    console.log(`Queueing LINE notification for new lawyer registration: ${lawyerName}`);
    return await pushToNotificationQueue({
      type: "LINE_NOTIFICATION",
      text: `⚖️ มีทนายความใหม่ลงทะเบียน: "${lawyerName}"\nกรุณาตรวจสอบและอนุมัติในระบบหลังบ้านค่ะ`,
    });
  },

  /**
   * Trigger 3: Send a LINE notification to admins for a new helpdesk ticket.
   */
  async notifyAdminNewTicket(ticketId: string, subject: string) {
    console.log(`Queueing LINE notification for new ticket: ${ticketId}`);
    return await pushToNotificationQueue({
      type: "LINE_NOTIFICATION",
      text: `🆘 มีตั๋วความช่วยเหลือใหม่ (Ticket #${ticketId}): "${subject}"\nกรุณาตรวจสอบในระบบแอดมินค่ะ`,
    });
  },

  /**
   * General Email Trigger
   */
  async sendEmail(to: string, subject: string, html: string) {
    console.log(`Queueing Email for ${to}`);
    return await pushToNotificationQueue({
      type: "EMAIL",
      data: { to, subject, html },
    });
  },
};
