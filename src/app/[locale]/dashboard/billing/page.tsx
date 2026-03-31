'use client';

import React, { useState } from 'react';
import { InvoiceList } from '@/components/billing/invoice-list';
import { Invoice } from '@/lib/types/billing-types';
import { CreditCard, ShieldCheck, Clock } from 'lucide-react';

const MOCK_INVOICES: Invoice[] = [
  { id: 'inv-1', case_id: 'case-1', client_id: 'cli-1', amount: 15000, currency: 'THB', status: 'paid', due_date: Date.now() - 86400000, createdAt: Date.now() - 86400000 * 5, paidAt: Date.now() - 86400000 },
  { id: 'inv-2', case_id: 'case-1', client_id: 'cli-1', amount: 5000, currency: 'THB', status: 'pending', due_date: Date.now() + 86400000 * 3, createdAt: Date.now() - 86400000 },
];

export default function ClientBillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);

  const pendingCount = invoices.filter(i => i.status === 'pending').length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <CreditCard className="w-6 h-6 mr-2 text-blue-600" />
          ชำระเงินและใบเสร็จ
        </h1>
        <p className="text-slate-500 mt-1">จัดการค่าใช้จ่ายทางกฎหมายของคุณอย่างปลอดภัย</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-slate-400 font-medium">รอการชำระ</div>
            <div className="text-xl font-bold text-slate-800">{pendingCount} รายการ</div>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 md:col-span-2">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-slate-400 font-medium">การชำระเงินที่ปลอดภัย</div>
            <div className="text-slate-600 text-sm">ข้อมูลการชำระเงินของคุณถูกเข้ารหัสและปกป้องโดยมาตรฐานความปลอดภัยระดับสูง</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 font-bold text-slate-800">
          ประวัติการแจ้งหนี้
        </div>
        <div className="p-2">
          <InvoiceList 
            invoices={invoices} 
            role="client" 
            onAction={(id) => alert(`เข้าสู่ระบบชำระเงินสำหรับ ${id}`)} 
          />
        </div>
      </div>

      <div className="mt-6 text-center text-slate-400 text-xs">
        มีปัญหาในการชำระเงิน? <a href="#" className="text-blue-600 underline">ติดต่อฝ่ายสนับสนุน</a>
      </div>
    </div>
  );
}
