'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PipelineBoard } from '@/components/lawyer/pipeline/pipeline-board';
import { Case, CaseStatus, Milestone } from '@/lib/types/billing-types';
import { LayoutDashboard, Filter, Search, Plus, ArrowLeft, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { 
  getLawyerLegalCases, 
  getCaseMilestones, 
  updateCaseStatusAction, 
  addCaseMilestoneAction, 
  toggleMilestoneStatusAction 
} from '@/app/actions/lawyer-case-actions';
import { useToast } from '@/hooks/use-toast';

export default function LawyerPipelinePage() {
  const { user } = useFirebase();
  const { toast } = useToast();
  const [cases, setCases] = useState<Case[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      if (!user?.uid) return;
      
      setIsLoading(true);
      try {
        const [fetchedCases, fetchedMilestones] = await Promise.all([
          getLawyerLegalCases(user.uid),
          getCaseMilestones(undefined, user.uid)
        ]);
        
        setCases(fetchedCases);
        setMilestones(fetchedMilestones);
      } catch (error) {
        console.error("Error loading pipeline data:", error);
        toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลคดีได้", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [user?.uid]);

  // Handlers
  const handleStatusChange = async (caseId: string, newStatus: CaseStatus) => {
    const previousCases = [...cases];
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: newStatus, updatedAt: Date.now() } : c));
    
    const result = await updateCaseStatusAction(caseId, newStatus);
    if (!result.success) {
      setCases(previousCases);
      toast({ title: "ไม่สามารถเปลี่ยนสถานะได้", description: result.error, variant: "destructive" });
    }
  };

  const handleAddMilestone = async (caseId: string, title: string) => {
    const result = await addCaseMilestoneAction(caseId, title);
    if (result.success) {
      const updatedMilestones = await getCaseMilestones(caseId);
      setMilestones(prev => [
        ...prev.filter(m => m.case_id !== caseId),
        ...updatedMilestones
      ]);
      toast({ title: "เพิ่ม Milestone สำเร็จ" });
    } else {
      toast({ title: "ไม่สามารถเพิ่มได้", description: result.error, variant: "destructive" });
    }
  };

  const handleToggleMilestone = async (milestoneId: string) => {
    const milestone = milestones.find(m => m.id === milestoneId);
    if (!milestone) return;

    setMilestones(prev => prev.map(m => 
      m.id === milestoneId ? { ...m, status: m.status === 'completed' ? 'pending' : 'completed' } : m
    ));

    const result = await toggleMilestoneStatusAction(milestoneId, milestone.case_id);
    if (!result.success) {
      setMilestones(prev => prev.map(m => 
        m.id === milestoneId ? { ...m, status: m.status === 'completed' ? 'pending' : 'completed' } : m
      ));
      toast({ title: "ไม่สามารถบันทึกได้", description: result.error, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto text-slate-800">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-slate-500">
        <Link href="/lawyer-dashboard" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          กลับไปหน้าแดชบอร์ด
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <LayoutDashboard className="w-6 h-6 mr-2 text-blue-600" />
            Case Pipeline Management
          </h1>
          <p className="text-slate-500 mt-1 text-sm">จัดการความคืบหน้าของคดีและ Milestone ในที่เดียว</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="ค้นหาชื่อคดี..." 
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none w-64"
            />
          </div>
          <Link href="/lawyer-dashboard/pipeline/new">
            <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              เปิดเคสใหม่
            </button>
          </Link>
        </div>
      </div>

      {/* Pipeline Board */}
      <PipelineBoard 
        cases={cases}
        milestones={milestones}
        onStatusChange={handleStatusChange}
        onAddMilestone={handleAddMilestone}
        onToggleMilestone={handleToggleMilestone}
      />
    </div>
  );
}
