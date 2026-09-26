'use client';
import { Button } from '@/components/ui/button';
import LawyerPageHeader from '@/components/lawyer/lawyer-page-header';

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
          getLawyerLegalCases(),
          getCaseMilestones()
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
    <>
      <LawyerPageHeader
        icon={LayoutDashboard}
        title="Pipeline คดี"
        description="ติดตามความคืบหน้าของคดีและ Milestone ในมุมมองกระดาน"
        back={{ href: '/lawyer-dashboard/cases', label: 'จัดการคดี' }}
        actions={
          <Link href="/lawyer-dashboard/pipeline/new">
            <Button className="rounded-xl gap-2 bg-[#002f4b] hover:bg-[#00466c] text-white">
              <Plus className="w-4 h-4" /> เปิดเคสใหม่
            </Button>
          </Link>
        }
      />

      {/* Pipeline Board */}
      <PipelineBoard 
        cases={cases}
        milestones={milestones}
        onStatusChange={handleStatusChange}
        onAddMilestone={handleAddMilestone}
        onToggleMilestone={handleToggleMilestone}
      />
    </>
  );
}
