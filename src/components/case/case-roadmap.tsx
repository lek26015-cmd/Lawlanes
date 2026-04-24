import { Check, MessageSquare, CreditCard, FileText, CheckCircle2, Gavel, Scale, AlertCircle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Step {
  id: number;
  label: string;
  icon: any;
  date?: string;
  status?: string;
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
    { id: 4, label: 'ตรวจพยานหลักฐาน', icon: Search },
    { id: 5, label: 'นัดสืบพยาน', icon: Gavel },
  ];

  const steps = customSteps || defaultSteps;

  return (
    <div className={cn("w-full pt-5 pb-10 md:pt-6 md:pb-12 px-2 md:px-6 bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-[2rem] md:rounded-3xl border border-white/40 dark:border-white/5 shadow-sm md:shadow-lg transition-all duration-500", className)}>
      <div className="relative flex justify-between items-center max-w-4xl mx-auto">
        {/* Progress Line Background */}
        <div className="absolute top-4 md:top-5 left-0 w-full h-[2px] md:h-[4px] bg-slate-200/50 dark:bg-slate-800 -z-0 rounded-full overflow-hidden">
          {/* Active Progress Line */}
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "h-full rounded-full relative",
              isPremium 
                ? "bg-gradient-to-r from-blue-400 via-blue-600 to-indigo-600" 
                : "bg-blue-500"
            )}
          >
             <motion.div 
               animate={{ x: ['-100%', '200%'] }}
               transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
               className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-20" 
             />
          </motion.div>
        </div>

        {/* Steps */}
        {steps.map((step, idx) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          const isFuture = step.id > currentStep;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative flex flex-col items-center z-10">
              {/* Pulsing Halo for Active Step */}
              <AnimatePresence>
                {isActive && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 0.15 }}
                    exit={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute top-0 w-8 h-8 md:w-12 md:h-12 bg-blue-500 rounded-full -z-10"
                  />
                )}
              </AnimatePresence>

              {isFuture ? (
                /* Future Step - Simple Dot */
                <div className="pt-3.5 md:pt-4.5">
                  <div className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 shadow-sm" />
                </div>
              ) : (
                /* Active or Completed Step - Icon Box */
                <motion.div 
                  initial={false}
                  animate={{ 
                    scale: isActive ? 1.15 : 1,
                    y: isActive ? -2 : 0,
                  }}
                  className={cn(
                    "w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-500 border md:border-2 shadow-md md:shadow-xl relative overflow-hidden",
                    isCompleted 
                      ? (isPremium ? "bg-blue-600 border-blue-500 text-white shadow-blue-500/30" : "bg-blue-500 border-blue-500 text-white")
                      : "bg-white dark:bg-slate-900 border-blue-600 text-blue-600 shadow-[0_15px_40px_rgba(37,99,235,0.4)]"
                  )}
                >
                  {isCompleted ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <Check className="w-4 h-4 md:w-6 md:h-6" strokeWidth={3} />
                    </motion.div>
                  ) : (
                    <Icon className={cn("w-4 h-4 md:w-6 md:h-6", isActive && "animate-pulse")} />
                  )}
                </motion.div>
              )}
              
              {/* Labels Container */}
              <div className="absolute top-10 md:top-16 flex flex-col items-center text-center w-[80px] md:w-[120px] pointer-events-none">
                <span 
                  className={cn(
                    "text-[6px] md:text-[8px] font-black uppercase tracking-widest transition-all duration-300",
                    isActive ? "text-blue-600 scale-110" : isCompleted ? "text-slate-500" : "text-slate-400 opacity-50"
                  )}
                >
                  PHASE {step.id}
                </span>
                
                <AnimatePresence>
                  {isActive && (
                    <motion.span 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="mt-1 text-[8px] md:text-[11px] font-black text-slate-900 dark:text-white italic leading-tight break-words px-1"
                    >
                      {step.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Status Dot for Future */}
                {!isActive && isFuture && (
                  <div className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mt-2 opacity-50" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
