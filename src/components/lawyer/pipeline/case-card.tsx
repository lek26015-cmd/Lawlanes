'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Case, CaseStatus, Milestone } from '@/lib/types/billing-types';
import { MilestoneManager } from './milestone-manager';
import { ChevronDown, Briefcase, Calendar, CheckCircle2, ExternalLink } from 'lucide-react';

interface CaseCardProps {
  initialCase: Case;
  milestones: Milestone[];
  onStatusChange: (caseId: string, newStatus: CaseStatus) => void;
  onAddMilestone: (caseId: string, title: string) => void;
  onToggleMilestone: (milestoneId: string) => void;
}

export const CaseCard: React.FC<CaseCardProps> = ({ 
  initialCase, 
  milestones, 
  onStatusChange,
  onAddMilestone,
  onToggleMilestone
}) => {
  const params = useParams();
  const locale = params.locale as string || 'th';
  const [isExpanded, setIsExpanded] = useState(false);

  const statusColors: Record<CaseStatus, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    drafting: 'bg-blue-100 text-blue-700 border-blue-200',
    'in-court': 'bg-purple-100 text-purple-700 border-purple-200',
    closed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-200 transition-all duration-200 overflow-hidden mb-4 group/card">
      <div className="p-4">
        {/* Header: Title and Status */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <Link href={`/${locale}/lawyer-dashboard/case/${initialCase.id}`} className="block group">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors">
                  {initialCase.title}
                </h3>
                <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all" />
              </div>
              <p className="text-slate-500 text-[11px] flex items-center bg-slate-50 w-fit px-2 py-0.5 rounded-lg border border-slate-100">
                <span className="mr-2 font-mono">ID: {initialCase.id}</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full mr-2"></span>
                <span>ลูกความ: {initialCase.client_id}</span>
              </p>
            </Link>
          </div>
          <select 
            value={initialCase.status}
            onChange={(e) => onStatusChange(initialCase.id, e.target.value as CaseStatus)}
            className={`text-xs font-semibold px-2 py-1 rounded-full border outline-none cursor-pointer ${statusColors[initialCase.status]}`}
          >
            <option value="pending">รอการตอบรับ</option>
            <option value="drafting">กำลังร่างเอกสาร</option>
            <option value="in-court">อยู่ในชั้นศาล</option>
            <option value="closed">ปิดเคส</option>
          </select>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>ความคืบหน้า Milestone</span>
            <span>{milestones.filter(m => m.status === 'completed').length}/{milestones.length}</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${milestones.length > 0 ? (milestones.filter(m => m.status === 'completed').length / milestones.length) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Footer: Toggle Milestones */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors pt-2 border-t border-slate-50"
        >
          <span className="flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            จัดการ Milestone
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded Section: Milestones */}
      {isExpanded && (
        <div className="bg-slate-50 border-t border-slate-100 p-4">
          <MilestoneManager 
            milestones={milestones}
            onAdd={(title: string) => onAddMilestone(initialCase.id, title)}
            onToggle={onToggleMilestone}
          />
        </div>
      )}
    </div>
  );
};
