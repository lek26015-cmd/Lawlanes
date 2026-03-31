'use client';

import React, { useState } from 'react';
import { Send, FileText, Calendar, DollarSign } from 'lucide-react';

interface InvoiceGeneratorProps {
  cases: { id: string, title: string }[];
  onSubmit: (data: any) => void;
}

export const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({ cases, onSubmit }) => {
  const [formData, setFormData] = useState({
    caseId: '',
    amount: '',
    dueDate: '',
    note: '',
    includeVat: false,
    taxId: '',
    address: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ caseId: '', amount: '', dueDate: '', note: '', includeVat: false, taxId: '', address: '' });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
        <Send className="w-5 h-5 mr-2 text-blue-600" />
        ออกใบแจ้งหนี้ / ใบกำกับภาษี
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Case Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">เลือกเคสที่ต้องการเก็บเงิน</label>
          <div className="relative">
            <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <select 
              required
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
              value={formData.caseId}
              onChange={(e) => setFormData({...formData, caseId: e.target.value})}
            >
              <option value="">เลือกเคส...</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">จำนวนเงินก่อนภาษี (บาท)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="number"
                required
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
              />
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">กำหนดชำระ</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="date"
                required
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={formData.dueDate}
                onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* VAT Toggle */}
        <div className="flex items-center space-x-2 py-2">
          <input 
            type="checkbox" 
            id="includeVat"
            checked={formData.includeVat}
            onChange={(e) => setFormData({...formData, includeVat: e.target.checked})}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
          />
          <label htmlFor="includeVat" className="text-sm font-medium text-slate-700">ออกใบกำกับภาษีเต็มรูปแบบ (VAT 7%)</label>
        </div>

        {formData.includeVat && (
          <div className="space-y-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="block text-xs font-bold text-blue-700 uppercase mb-1">เลขประจำตัวผู้เสียภาษี (ลูกความ)</label>
              <input 
                type="text"
                placeholder="13 หลัก"
                className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                value={formData.taxId}
                onChange={(e) => setFormData({...formData, taxId: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-blue-700 uppercase mb-1">ที่อยู่ตามบัตร/ใบทะเบียนภาษี</label>
              <input 
                type="text"
                placeholder="ที่อยู่สำหรับออกใบกำกับภาษี"
                className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>
          </div>
        )}

        {/* Note */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">หมายเหตุเพิ่มเติม</label>
          <textarea 
            placeholder="รายละเอียดงาน หรือข้อความถึงลูกความ..."
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all h-24 resize-none"
            value={formData.note}
            onChange={(e) => setFormData({...formData, note: e.target.value})}
          />
        </div>

        <button 
          type="submit"
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 active:scale-[0.98]"
        >
          ยืนยันการออกใบแจ้งหนี้
        </button>
      </form>
    </div>
  );
};
