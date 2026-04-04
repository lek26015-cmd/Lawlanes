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
    <div className={cn("w-full pt-10 pb-16 px-8 bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-[3rem] border border-white/40 dark:border-white/5 shadow-2xl transition-all duration-500", className)}>
      <div className="relative flex justify-between items-center max-w-5xl mx-auto">
        {/* Progress Line Background */}
        <div className="absolute top-7 left-0 w-full h-[4px] bg-slate-200/50 dark:bg-slate-800 -z-0 rounded-full overflow-hidden">
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
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative flex flex-col items-center z-10 group">
              {/* Pulsing Halo for Active Step */}
              <AnimatePresence>
                {isActive && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0, y: -4 }}
                    animate={{ scale: 1.35, opacity: 0.25, y: -4 }}
                    exit={{ scale: 1.8, opacity: 0, y: -4 }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute top-0 w-14 h-14 bg-blue-500 rounded-[1.25rem] -z-10"
                  />
                )}
              </AnimatePresence>

              <motion.div 
                initial={false}
                animate={{ 
                  scale: isActive ? 1.15 : 1,
                  y: isActive ? -4 : 0,
                  rotate: isActive ? [0, -5, 5, 0] : 0
                }}
                transition={{ 
                   type: "spring", 
                   stiffness: 300, 
                   damping: 15,
                   rotate: { duration: 0.5, repeat: isActive ? 0 : 0 }
                }}
                className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 shadow-2xl relative overflow-hidden",
                  isCompleted 
                    ? (isPremium ? "bg-blue-600 border-blue-500 text-white shadow-blue-500/40" : "bg-blue-500 border-blue-500 text-white")
                    : isActive
                      ? (isPremium ? "bg-white dark:bg-slate-900 border-blue-600 text-blue-600 shadow-[0_15px_40px_rgba(37,99,235,0.4)]" : "bg-white dark:bg-slate-900 border-blue-500 text-blue-500 shadow-lg")
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400"
                )}
              >
                {isCompleted ? (
                   <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
                     <Check className="w-7 h-7" strokeWidth={3} />
                   </motion.div>
                ) : (
                   <Icon className={cn("w-6 h-6", isActive && "animate-pulse")} />
                )}
                
                {isActive && isPremium && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/10 to-transparent pointer-events-none" />
                )}
              </motion.div>
              
              <div className="absolute top-20 flex flex-col items-center text-center w-[110px] sm:w-[120px] px-1 pointer-events-none">
                <div className="flex items-center justify-center gap-1.5 mb-1 w-full">
                  <span 
                    className={cn(
                      "text-[9px] font-black uppercase tracking-[0.1em] transition-colors duration-300",
                      isActive ? "text-blue-600" : isCompleted ? "text-slate-500" : "text-slate-400"
                    )}
                  >
                    PHASE {step.id}
                  </span>
                  {isActive && <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity }} className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0" />}
                </div>
                <span 
                  className={cn(
                    "text-[11px] font-black transition-all duration-300 italic tracking-tight leading-tight line-clamp-2 min-h-[2.2em]",
                    isActive 
                      ? "text-slate-900 dark:text-white" 
                      : isCompleted 
                        ? "text-slate-600 dark:text-slate-400"
                        : "text-slate-400"
                  )}
                >
                  {step.label}
                </span>
                
                {/* Date/Status Info */}
                <AnimatePresence>
                  {(isActive || isCompleted) && step.date && (
                    <motion.span 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1 text-[8px] font-bold text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-widest truncate max-w-full"
                    >
                      {step.date}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
