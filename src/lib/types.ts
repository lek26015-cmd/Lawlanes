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
