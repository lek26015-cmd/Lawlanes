'use client';

import React from 'react';
import { Invoice } from '@/lib/types/billing-types';
import { StatusBadge } from './status-badge';
import { CreditCard, Bell, Download, ExternalLink } from 'lucide-react';

interface InvoiceListProps {
  invoices: Invoice[];
  role: 'lawyer' | 'client';
  onAction?: (invoiceId: string) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({ invoices, role, onAction }) => {
  const formatCurrency = (amount: number, currency: string = 'THB') => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <p className="text-slate-400 italic">แดชบอร์ดว่างเปล่า ยังไม่มีรายการแจ้งหนี้</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 text-sm">
            <th className="py-4 px-4 font-semibold">เลขที่ใบแจ้งหนี้</th>
            <th className="py-4 px-4 font-semibold">รายการ / เคส</th>
            <th className="py-4 px-4 font-semibold text-right">จำนวนเงิน</th>
            <th className="py-4 px-4 font-semibold">กำหนดชำระ</th>
            <th className="py-4 px-4 font-semibold">สถานะ</th>
            <th className="py-4 px-4 font-semibold text-right">การจัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-slate-50 transition-colors group">
              <td className="py-4 px-4 text-sm font-mono text-slate-500">
                #{invoice.id.substring(0, 8).toUpperCase()}
              </td>
              <td className="py-4 px-4">
                <div className="text-sm font-medium text-slate-800">Case: {invoice.case_id.substring(0, 8)}</div>
                <div className="text-xs text-slate-400">สร้างเมื่อ: {formatDate(invoice.createdAt)}</div>
              </td>
              <td className="py-4 px-4 text-right font-bold text-slate-900">
                {formatCurrency(invoice.amount, invoice.currency)}
              </td>
              <td className="py-4 px-4 text-sm text-slate-600">
                {formatDate(invoice.due_date)}
              </td>
              <td className="py-4 px-4">
                <StatusBadge status={invoice.status} />
              </td>
              <td className="py-4 px-4 text-right">
                <div className="flex justify-end space-x-2">
                  <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="ดาวน์โหลด PDF">
                    <Download className="w-4 h-4" />
                  </button>
                  
                  {role === 'client' && invoice.status === 'pending' && (
                    <button 
                      onClick={() => onAction?.(invoice.id)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>ชำระเงิน</span>
                    </button>
                  )}

                  {role === 'lawyer' && invoice.status === 'pending' && (
                    <button 
                      onClick={() => onAction?.(invoice.id)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>แจ้งเตือน</span>
                    </button>
                  )}

                  {invoice.status === 'paid' && (
                    <button className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100 cursor-default">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>ดูหลักฐาน</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
