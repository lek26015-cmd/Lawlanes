'use client';

import { Check, MessageSquare, CreditCard, FileText, CheckCircle2, Gavel, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Step {
  id: number;
  label: string;
  icon: any;
}

interface CaseRoadmapProps {
  currentStep: number;
  className?: string;
  isPremium?: boolean;
  steps?: Step[];
}

export function CaseRoadmap({ currentStep, className, isPremium = true, steps: customSteps }: CaseRoadmapProps) {
  const defaultSteps: Step[] = [
    { id: 1, label: 'วิเคราะห์รูปคดี', icon: Scale },
    { id: 2, label: 'จัดเตรียมเอกสาร', icon: FileText },
    { id: 3, label: 'ยื่นคำฟ้อง', icon: Gavel },
    { id: 4, label: 'ตรวจพยานหลักฐาน', icon: CheckCircle2 },
    { id: 5, label: 'นัดสืบพยาน', icon: Gavel },
  ];

  const steps = customSteps || defaultSteps;

  return (
    <div className={cn("w-full py-8 px-6 bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-[2.5rem] border border-white/40 dark:border-white/5 shadow-2xl transition-all duration-500", className)}>
      <div className="relative flex justify-between items-center max-w-4xl mx-auto">
        {/* Progress Line Background */}
        <div className="absolute top-6 left-0 w-full h-[3px] bg-slate-200/50 dark:bg-slate-800 -z-0 rounded-full">
          {/* Active Progress Line */}
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 1, ease: "circOut" }}
            className={cn(
              "h-full rounded-full relative",
              isPremium 
                ? "bg-gradient-to-r from-blue-400 via-blue-600 to-indigo-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]" 
                : "bg-blue-500"
            )}
          >
             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg animate-pulse" />
          </motion.div>
        </div>

        {/* Steps */}
        {steps.map((step, idx) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative flex flex-col items-center z-10 group">
              <motion.div 
                initial={false}
                animate={{ 
                  scale: isActive ? 1.2 : 1,
                  y: isActive ? -4 : 0
                }}
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 shadow-xl",
                  isCompleted 
                    ? (isPremium ? "bg-blue-600 border-blue-500 text-white shadow-blue-500/20" : "bg-blue-500 border-blue-500 text-white")
                    : isActive
                      ? (isPremium ? "bg-white dark:bg-slate-900 border-blue-600 text-blue-600 shadow-[0_10px_30px_rgba(37,99,235,0.3)]" : "bg-white dark:bg-slate-900 border-blue-500 text-blue-500 shadow-lg")
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400"
                )}
              >
                {isCompleted ? (
                   <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                     <Check className="w-6 h-6" strokeWidth={3} />
                   </motion.div>
                ) : (
                   <Icon className={cn("w-5 h-5", isActive && "animate-pulse")} />
                )}
              </motion.div>
              
              <div className="absolute top-16 flex flex-col items-center whitespace-nowrap">
                <span 
                  className={cn(
                    "text-[10px] font-black uppercase tracking-widest transition-colors duration-300",
                    isActive ? "text-blue-600" : isCompleted ? "text-slate-500" : "text-slate-400"
                  )}
                >
                  Step {step.id}
                </span>
                <span 
                  className={cn(
                    "mt-0.5 text-[11px] font-bold transition-all duration-300 italic",
                    isActive 
                      ? "text-slate-900 dark:text-white scale-110" 
                      : isCompleted 
                        ? "text-slate-600 dark:text-slate-400"
                        : "text-slate-400"
                  )}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
