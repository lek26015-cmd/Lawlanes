'use client';

import React, { useState, useEffect } from 'react';
import { InvoiceList } from '@/components/billing/invoice-list';
import { Invoice } from '@/lib/types/billing-types';
import { CreditCard, ShieldCheck, Clock, Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { getUserInvoicesAction } from '@/app/actions/billing-actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function ClientBillingPage() {
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading || !user) return;

    async function fetchData() {
      setIsLoading(true);
      try {
        const res = await getUserInvoicesAction(user!.uid);
        if (res.success) {
          setInvoices(res.data || []);
        }
      } catch (error) {
        console.error("Error fetching billing data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [user, isUserLoading]);

  if (isUserLoading || isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

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
            onAction={(id) => router.push(`/payment?chatId=${invoices.find(i => i.id === id)?.case_id}&type=case`)} 
            onViewEvidence={(inv) => {
              if (inv.evidence_url) {
                window.open(inv.evidence_url, '_blank');
              } else {
                toast({ title: "ไม่พบหลักฐาน", description: "ยังไม่มีการแนบหลักฐานการชำระเงินสำหรับรายการนี้" });
              }
            }}
          />
        </div>
      </div>

      <div className="mt-6 text-center text-slate-400 text-xs">
        มีปัญหาในการชำระเงิน? <a href="#" className="text-blue-600 underline">ติดต่อฝ่ายสนับสนุน</a>
      </div>
    </div>
  );
}
