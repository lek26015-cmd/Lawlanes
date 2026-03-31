'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface ShowcaseCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  status: 'active' | 'pending' | 'secure';
  link?: string;
  color: string;
  techStack: string[];
}

export const ShowcaseCard: React.FC<ShowcaseCardProps> = ({
  title,
  description,
  icon: Icon,
  status,
  link,
  color,
  techStack
}) => {
  const statusColors = {
    active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    secure: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  };

  return (
    <div className="group relative bg-white/40 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-300/60 transition-all duration-500 hover:-translate-y-2 overflow-hidden">
      {/* Background Decor */}
      <div className={`absolute -right-8 -top-8 w-24 h-24 rounded-full opacity-10 blur-2xl transition-all duration-700 group-hover:scale-150 ${color}`} />
      
      <div className="relative z-10">
        <div className={`inline-flex p-3 rounded-2xl ${color} bg-opacity-10 mb-4 transition-transform duration-500 group-hover:rotate-12`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>

        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${statusColors[status]}`}>
            {status}
          </span>
        </div>

        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          {description}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-6">
          {techStack.map((tech) => (
            <span key={tech} className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
              {tech}
            </span>
          ))}
        </div>

        {link ? (
          <Link 
            href={link}
            className="inline-flex items-center text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors"
          >
            Explore System 
            <span className="ml-1 transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        ) : (
          <span className="text-sm font-bold text-slate-400 cursor-not-allowed">Automated Engine</span>
        )}
      </div>
    </div>
  );
};
