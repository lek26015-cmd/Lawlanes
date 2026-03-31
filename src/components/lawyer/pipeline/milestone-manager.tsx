'use client';

import React, { useState } from 'react';
import { Milestone } from '@/lib/types/billing-types';
import { Plus, Check, Circle } from 'lucide-react';

interface MilestoneManagerProps {
  milestones: Milestone[];
  onAdd: (title: string) => void;
  onToggle: (milestoneId: string) => void;
}

export const MilestoneManager: React.FC<MilestoneManagerProps> = ({ 
  milestones, 
  onAdd, 
  onToggle 
}) => {
  const [newMilestone, setNewMilestone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMilestone.trim()) {
      onAdd(newMilestone.trim());
      setNewMilestone('');
    }
  };

  return (
    <div className="space-y-3">
      {/* Milestone List */}
      <div className="space-y-2">
        {milestones.length === 0 ? (
          <p className="text-xs text-slate-400 italic">ยังไม่มี Milestone สำหรับเคสนี้</p>
        ) : (
          milestones.map((milestone) => (
            <div 
              key={milestone.id}
              onClick={() => onToggle(milestone.id)}
              className="flex items-center bg-white p-2 rounded-lg border border-slate-200 cursor-pointer hover:border-blue-400 transition-colors group"
            >
              <div className="mr-3">
                {milestone.status === 'completed' ? (
                  <div className="bg-blue-600 text-white rounded-full p-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                ) : (
                  <Circle className="w-4 h-4 text-slate-300 group-hover:text-blue-400" />
                )}
              </div>
              <span className={`text-sm ${milestone.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                {milestone.title}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Add New Milestone */}
      <form onSubmit={handleSubmit} className="relative mt-4">
        <input 
          type="text"
          value={newMilestone}
          onChange={(e) => setNewMilestone(e.target.value)}
          placeholder="เพิ่ม Milestone ใหม่..."
          className="w-full text-sm bg-white border border-slate-200 rounded-lg py-2 pl-3 pr-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
        />
        <button 
          type="submit"
          disabled={!newMilestone.trim()}
          className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400"
        >
          <Plus className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
