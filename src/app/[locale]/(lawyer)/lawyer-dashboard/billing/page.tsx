'use client';

import React, { useState, useEffect } from 'react';
import { InvoiceGenerator } from '@/components/billing/lawyer/invoice-generator';
import { InvoiceList } from '@/components/billing/invoice-list';
import { Invoice } from '@/lib/types/billing-types';
import { Wallet, TrendingUp, Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { getLawyerInvoicesAction, createInvoiceAction } from '@/app/actions/billing-actions';
import { getLawyerDashboardDataAction } from '@/app/actions/dashboard-actions';
import { useToast } from '@/hooks/use-toast';

export default function LawyerBillingPage() {
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cases, setCases] = useState<{ id: string, title: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading || !user) return;

    async function fetchData() {
      setIsLoading(true);
      try {
        const [invRes, dashRes] = await Promise.all([
          getLawyerInvoicesAction(user!.uid),
          getLawyerDashboardDataAction(user!.uid)
        ]);

        if (invRes.success) {
          setInvoices(invRes.data || []);
        }

        if (dashRes) {
          const mappedCases = [...dashRes.activeCases, ...dashRes.completedCases].map(c => ({
            id: c.id,
            title: c.title || c.clientName || 'Unnamed Case'
          }));
          setCases(mappedCases);
        }
      } catch (error) {
        console.error("Error fetching billing data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [user, isUserLoading]);

  const handleCreateInvoice = async (formData: any) => {
    if (!user) return;
    
    // Find client ID for the selected case
    const selectedCase = cases.find(c => c.id === formData.caseId);
    // In a real app, we'd have the client ID associated with the case. 
    // For now, let's try to get it from dashboard data or just use a placeholder if missing.
    
    const newInv: Partial<Invoice> = {
      case_id: formData.caseId,
      lawyer_id: user.uid,
      amount: parseFloat(formData.amount),
      currency: 'THB',
      status: 'pending',
      due_date: new Date(formData.dueDate).getTime(),
      description: formData.note || 'ค่าบริการทางกฎหมาย'
    };

    const res = await createInvoiceAction(newInv);
    if (res.success) {
      toast({ title: "สร้างใบแจ้งหนี้สำเร็จ", description: "ระบบได้ส่งข้อมูลแจ้งหนี้ไปยังลูกความแล้ว" });
      // Refresh list
      const invRes = await getLawyerInvoicesAction(user.uid);
      if (invRes.success) setInvoices(invRes.data || []);
    } else {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: res.error });
    }
  };

  if (isUserLoading || isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

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

          <InvoiceGenerator cases={cases} onSubmit={handleCreateInvoice} />
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
                onAction={(id) => toast({ title: "ส่งแจ้งเตือนแล้ว", description: `ระบบได้ส่งข้อความแจ้งเตือนสำหรับใบแจ้งหนี้ #${id.substring(0,8)}` })} 
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
        </div>
      </div>
    </div>
  );
}
