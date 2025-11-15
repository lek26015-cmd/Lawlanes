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
