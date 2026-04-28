/**
 * Database types for Case Management and Billing (LawsLane)
 */

export type CaseStatus = 'pending' | 'drafting' | 'in-court' | 'closed';
export type MilestoneStatus = 'pending' | 'completed';
export type InvoiceStatus = 'pending' | 'paid' | 'overdue';

/**
 * Legal Case interface
 */
export interface Case {
  id: string;
  lawyer_id: string;
  client_id: string;
  title: string;
  description?: string;
  status: CaseStatus;
  createdAt: number; // Unix timestamp
  updatedAt: number;
  metadata?: string; // JSON string for extended fields
}

/**
 * Case Milestone interface
 */
export interface Milestone {
  id: string;
  case_id: string;
  title: string;
  status: MilestoneStatus;
  dueDate?: number;
  createdAt: number;
}

/**
 * Billing Invoice interface
 */
export interface Invoice {
  id: string;
  case_id: string;
  milestone_id?: string;
  client_id: string;
  amount: number;
  vat_amount?: number; // 7% VAT if applicable
  tax_id?: string;     // Tax ID for Tax Invoice
  billing_address?: string;
  currency: string;
  status: InvoiceStatus;
  due_date: number;
  paidAt?: number;
  evidence_url?: string; // URL to payment slip or evidence
  pdf_url?: string;      // URL to the formal PDF invoice
  createdAt: number;
}
