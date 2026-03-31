'use client';

import React, { useState } from 'react';
import { InvoiceGenerator } from '@/components/billing/lawyer/invoice-generator';
import { InvoiceList } from '@/components/billing/invoice-list';
import { Invoice } from '@/lib/types/billing-types';
import { Wallet, TrendingUp, AlertCircle } from 'lucide-react';

const MOCK_CASES = [
  { id: 'case-1', title: 'คดีดีเบรคสัญญาจ้าง' },
  { id: 'case-2', title: 'การจดทะเบียนเครื่องหมายการค้า' }
];

const MOCK_INVOICES: Invoice[] = [
  { id: 'inv-1', case_id: 'case-1', client_id: 'cli-1', amount: 15000, currency: 'THB', status: 'paid', due_date: Date.now() - 86400000, createdAt: Date.now() - 86400000 * 5, paidAt: Date.now() - 86400000 },
  { id: 'inv-2', case_id: 'case-1', client_id: 'cli-1', amount: 5000, currency: 'THB', status: 'pending', due_date: Date.now() + 86400000 * 3, createdAt: Date.now() - 86400000 },
];

export default function LawyerBillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);

  const handleCreateInvoice = (data: any) => {
    const newInv: Invoice = {
      id: `inv-${Math.random().toString(36).substr(2, 9)}`,
      case_id: data.caseId,
      client_id: 'cli-1', // Mock
      amount: parseFloat(data.amount),
      currency: 'THB',
      status: 'pending',
      due_date: new Date(data.dueDate).getTime(),
      createdAt: Date.now()
    };
    setInvoices([newInv, ...invoices]);
  };

  const totalEarned = invoices.filter(i => i.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
  const pendingAmount = invoices.filter(i => i.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center">
          <Wallet className="w-6 h-6 mr-2 text-blue-600" />
          การเงินและใบแจ้งหนี้
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Summary & Form */}
        <div className="space-y-6">
          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
            <p className="text-blue-100 text-sm font-medium">รวมรายได้ทั้งหมด</p>
            <h2 className="text-3xl font-bold mt-1">฿{totalEarned.toLocaleString()}</h2>
            <div className="mt-4 pt-4 border-t border-blue-500/30 flex items-center text-sm">
              <TrendingUp className="w-4 h-4 mr-1.5" />
              <span>รอนำส่ง: ฿{pendingAmount.toLocaleString()}</span>
            </div>
          </div>

          <InvoiceGenerator cases={MOCK_CASES} onSubmit={handleCreateInvoice} />
        </div>

        {/* Right: Invoice List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">รายการแจ้งหนี้ทั้งหมด</h2>
              <div className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                {invoices.length} รายการ
              </div>
            </div>
            <div className="p-2">
              <InvoiceList 
                invoices={invoices} 
                role="lawyer" 
                onAction={(id) => alert(`ส่งการแจ้งเตือนสำหรับ ${id}`)} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
