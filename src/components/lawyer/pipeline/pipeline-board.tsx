'use client';

import React from 'react';
import { Case, CaseStatus, Milestone } from '@/lib/types/billing-types';
import { CaseCard } from './case-card';

interface PipelineBoardProps {
  cases: Case[];
  milestones: Milestone[];
  onStatusChange: (caseId: string, newStatus: CaseStatus) => void;
  onAddMilestone: (caseId: string, title: string) => void;
  onToggleMilestone: (milestoneId: string) => void;
}

export const PipelineBoard: React.FC<PipelineBoardProps> = ({
  cases,
  milestones,
  onStatusChange,
  onAddMilestone,
  onToggleMilestone
}) => {
  const columns: { label: string; status: CaseStatus; color: string }[] = [
    { label: 'รอดำเนินการ (Pending)', status: 'pending', color: 'border-amber-400' },
    { label: 'กำลังดำเนินการ (Drafting)', status: 'drafting', color: 'border-blue-400' },
    { label: 'อยู่ระหว่างพิจารณา (In-Court)', status: 'in-court', color: 'border-purple-400' },
    { label: 'ปิดเคสเรียบร้อย (Closed)', status: 'closed', color: 'border-emerald-400' },
  ];

  return (
    <div className="flex overflow-x-auto pb-6 space-x-6 min-h-[calc(100vh-200px)]">
      {columns.map((column) => (
        <div key={column.status} className="flex-shrink-0 w-80">
          {/* Column Header */}
          <div className={`flex items-center justify-between mb-4 pb-2 border-b-2 ${column.color}`}>
            <h2 className="font-bold text-slate-700">{column.label}</h2>
            <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">
              {cases.filter(c => c.status === column.status).length}
            </span>
          </div>

          {/* Column Content */}
          <div className="space-y-4">
            {cases
              .filter((c) => c.status === column.status)
              .map((c) => (
                <CaseCard 
                  key={c.id} 
                  initialCase={c} 
                  milestones={milestones.filter(m => m.case_id === c.id)}
                  onStatusChange={onStatusChange}
                  onAddMilestone={onAddMilestone}
                  onToggleMilestone={onToggleMilestone}
                />
              ))}
            
            {cases.filter(c => c.status === column.status).length === 0 && (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50">
                <p className="text-slate-400 text-sm italic">ไม่มีเคสในกลุ่มนี้</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
