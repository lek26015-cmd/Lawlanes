
import { ChatResponse } from "@/ai/flows/chat-flow";

export interface LawyerProfile {
  id: string;
  userId: string;
  name: string;
  status: 'approved' | 'pending' | 'rejected';
  description: string;
  specialty: string[];
  imageUrl: string;
  imageHint: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string | ChatResponse;
  needsLawyer?: boolean;
  handoffMessage?: string;
}

export interface HumanChatMessage {
    id: string;
    text: string;
    senderId: string;
    timestamp: any;
}


export interface Article {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  imageHint: string;
  content: string;
}

export interface Case {
  id: string;
  title: string;
  lawyer: Pick<LawyerProfile, 'id' | 'name' | 'imageUrl' | 'imageHint'>;
  lastMessage: string;
  lastMessageTimestamp: string;
  status: 'active' | 'closed';
  hasNewMessage?: boolean;
  color?: 'blue' | 'yellow';
}

export interface UpcomingAppointment {
    id: string;
    lawyer: Pick<LawyerProfile, 'name' | 'imageUrl' | 'imageHint'>;
    date: Date;
    description: string;
    time: string;
}

export interface Document {
    id: string;
    name: string;
    status: string;
    isCompleted: boolean;
}

export interface ReportedTicket {
  id: string;
  caseId: string;
  lawyerId: string;
  caseTitle: string;
  problemType: string;
  status: 'pending' | 'resolved';
  reportedAt: Date;
}

// Types for Lawyer Dashboard
export interface LawyerAppointmentRequest {
  id: string;
  clientName: string;
  caseTitle: string;
  description: string;
  requestedAt: Date;
}

export interface LawyerCase {
  id: string;
  title: string;
  clientName: string;
  clientId: string;
  status: 'รอการตอบรับ' | 'กำลังดำเนินการ' | 'เสร็จสิ้น';
  lastUpdate: string;
  hasNewMessage: boolean;
}
