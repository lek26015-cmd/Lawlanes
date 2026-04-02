'use server';

import { NotificationService } from "@/services/notification-service";

/**
 * Server action to notify admins when a new lawyer registers.
 * Can be called from client components.
 */
export async function notifyAdminNewLawyerAction(name: string, email?: string) {
  try {
    return await NotificationService.notifyAdminNewLawyer(name, email);
  } catch (error) {
    console.error("Error in notifyAdminNewLawyerAction:", error);
    return { success: false, error: "Failed to send notification" };
  }
}

/**
 * Server action to send a general notification.
 */
export async function notifyLawyerNewChatAction(params: {
  lawyerId: string;
  lawyerName: string;
  lawyerEmail: string;
  lawyerLineId?: string;
  clientName: string;
  messageSnippet: string;
  chatId: string;
}) {
  try {
    return await NotificationService.notifyLawyerNewChat(params);
  } catch (error) {
    console.error("Error in notifyLawyerNewChatAction:", error);
    return { success: false, error: "Failed to send notification" };
  }
}
