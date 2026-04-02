
'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCaseById } from '@/lib/data';
import { 
  ArrowLeft, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  FileText, 
  User, 
  CreditCard,
  Plus,
  Loader2,
  FolderOpen,
  Gavel,
  History,
  Info,
  MoreVertical,
  Download,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Scale,
  Check,
  ChevronRight
} from 'lucide-react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription, 
  CardFooter 
} from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirebase } from '@/firebase';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { CaseRoadmap } from '@/components/case/case-roadmap';
import { LegalResearchTool } from '@/components/case/legal-research-tool';
import { InterpreterSearchTool } from '@/components/case/interpreter-search-tool';
import { Sparkles, BrainCircuit, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

import { getCaseMilestones, addCaseMilestoneAction, toggleMilestoneStatusAction, generateCaseStrategicAdviceAction } from '@/app/actions/lawyer-case-actions';
import { Milestone } from '@/lib/types/billing-types';
import ReactMarkdown from 'react-markdown';

function CaseDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [caseData, setCaseData] = useState<any>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [activeDocCategory, setActiveDocCategory] = useState('รายการเอกสารทั้งหมด');
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);
  const [showWitnessList, setShowWitnessList] = useState(false);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  
  // New state for full-page subviews
  const [activeSubView, setActiveSubView] = useState<null | 'event' | 'document' | 'evidence' | 'witness'>(null);
  const [witnessStep, setWitnessStep] = useState<0 | 1 | 2 | 3>(0);
  const [witnessPersons, setWitnessPersons] = useState<{name: string, role: string}[]>([]);
  const [newWitness, setNewWitness] = useState({ name: '', role: '' });
  const [showAddWitnessForm, setShowAddWitnessForm] = useState(false);
  const [editingWitnessIndex, setEditingWitnessIndex] = useState<number | null>(null);
  const [editingFactIndex, setEditingFactIndex] = useState<number | null>(null);
  const [tempFact, setTempFact] = useState('');
  const [selectedEvidenceCategories, setSelectedEvidenceCategories] = useState<string[]>(['docs', 'tech']);
  const [isSigned, setIsSigned] = useState(false);
  const [strategicAdvice, setStrategicAdvice] = useState<string | null>(null);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Priority-based subview selection
    if (selectedEvent) setActiveSubView('event');
    else if (viewingDoc) setActiveSubView('document');
    else if (selectedEvidence) setActiveSubView('evidence');
    else if (showWitnessList) setActiveSubView('witness');
    else setActiveSubView(null);
  }, [selectedEvent, viewingDoc, selectedEvidence, showWitnessList]);

  useEffect(() => {
    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    // Prevent common shortcuts (Copy, Screenshot shortcuts detection)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewingDoc) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 's' || e.key === 'p') || e.key === 'PrintScreen') {
          e.preventDefault();
          toast({ 
            title: "SECURITY ALERT", 
            description: "ห้ามคัดลอกหรือบันทึกเอกสารภายนอกระบบ Lawslane เพื่อรักษาความปลอดภัย",
            variant: "destructive"
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (viewingDoc) {
      setIsVerifying(true);
      const timer = setTimeout(() => setIsVerifying(false), 1500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewingDoc]);

  useEffect(() => {
    async function fetchData() {
      if (!firestore || !id) return;
      
      setIsLoading(true);
      try {
        const [data, fetchedMilestones] = await Promise.all([
          getCaseById(firestore, id),
          getCaseMilestones(id)
        ]);

        if (!data) {
          setCaseData(null);
        } else {
          setCaseData(data);
          setMilestones(fetchedMilestones);
        }
      } catch (error) {
        console.error("Error loading case details:", error);
        toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลคดีได้", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id, firestore]);

  const completedMilestones = milestones.filter(m => m.status === 'completed').length;
  const totalMilestones = milestones.length;
  const currentStep = totalMilestones > 0 ? (completedMilestones === totalMilestones ? totalMilestones : completedMilestones + 1) : 1;

  const handleToggleMilestone = async (milestoneId: string) => {
    // Optimistic update
    setMilestones(prev => prev.map(m => 
      m.id === milestoneId ? { ...m, status: m.status === 'completed' ? 'pending' : 'completed' } : m
    ));

    const result = await toggleMilestoneStatusAction(milestoneId, id);
    if (!result.success) {
      // Revert on error
      setMilestones(prev => prev.map(m => 
        m.id === milestoneId ? { ...m, status: m.status === 'completed' ? 'pending' : 'completed' } : m
      ));
      toast({ title: "ไม่สามารถบันทึกได้", description: result.error, variant: "destructive" });
    } else {
       toast({ title: "อัปเดตสถานะสำเร็จ" });
    }
  };

  const handleAddMilestone = async (caseId: string, title: string) => {
    const result = await addCaseMilestoneAction(caseId, title);
    if (result.success) {
      const updatedMilestones = await getCaseMilestones(caseId);
      setMilestones(updatedMilestones);
      toast({ title: "เพิ่ม Milestone สำเร็จ" });
    } else {
      toast({ title: "ไม่สามารถเพิ่มได้", description: result.error, variant: "destructive" });
    }
  };

  const handleGenerateAdvice = async () => {
    if (!caseData) return;
    setIsGeneratingAdvice(true);
    try {
      const result = await generateCaseStrategicAdviceAction(id, caseData.title, milestones);
      if (result.success && result.advice) {
        setStrategicAdvice(result.advice);
        toast({ title: "วิเคราะห์กลยุทธ์สำเร็จ", description: "AI ได้จัดเตรียมคำแนะนำสำหรับคดีนี้แล้ว" });
      } else {
        toast({ title: "ไม่สามารถวิเคราะห์ได้", description: result.error, variant: "destructive" });
      }
    } catch (error) {
       toast({ title: "เกิดข้อผิดพลาด", description: "กรุณาลองใหม่อีกครั้ง", variant: "destructive" });
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h2 className="text-2xl font-bold mb-4">ไม่พบข้อมูลคดี</h2>
        <Button onClick={() => router.push('/lawyer-dashboard')}>กลับไปหน้าแดชบอร์ด</Button>
      </div>
    );
  }

  // --- SUBVIEW RENDERING (Replacing Dialogs with "Next Pages") ---
  
  if (activeSubView === 'event' && selectedEvent) {
    return (
      <div className="bg-slate-50 min-h-screen pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="container mx-auto max-w-6xl px-4 pt-12 space-y-8">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-900 group">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> กลับสู่หน้าแดชบอร์ด
             </Button>
             <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
             <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Case Activity Detail</span>
          </div>

          <div className="rounded-3xl overflow-hidden shadow-2xl bg-white border border-slate-100 flex flex-col min-h-[70vh]">
              <div className={`h-48 ${selectedEvent.color} flex items-center px-12 relative overflow-hidden`}>
                <div className="absolute right-[-20px] top-[-20px] opacity-10 rotate-12 scale-150">
                    {React.cloneElement(selectedEvent.icon as React.ReactElement<any>, { size: 240 })}
                </div>
                <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mr-8 shadow-sm border border-white/30">
                  {React.cloneElement(selectedEvent.icon as React.ReactElement<any>, { size: 48 })}
                </div>
                <div className="text-white z-10">
                  <p className="text-sm uppercase font-bold tracking-widest opacity-80">{selectedEvent.type} Records</p>
                  <h1 className="text-5xl font-bold font-headline leading-tight mt-1">{selectedEvent.title}</h1>
                </div>
              </div>

              <div className="p-16 flex-1 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                   <div className="md:col-span-2 space-y-12">
                      <section className="space-y-6">
                         <h5 className="font-bold text-slate-900 text-2xl flex items-center gap-2">
                            <FileText className="w-7 h-7 text-blue-600" /> บันทึกข้อเท็จจริง
                         </h5>
                         <p className="text-slate-500 leading-loose text-xl">
                            "ข้อมูลกิจกรรมนี้ได้รับการบันทึกผ่านระบบ Lawslane เพื่อใช้เป็นพยานหลักฐานในคดีความแพ่ง พยานบุคคลและเอกสารที่เกี่ยวข้องได้รับการตรวจสอบความถูกต้องโดยทนายความผู้รับผิดชอบ และพร้อมสำหรับการสืบพยานในลำดับถัดไป"
                         </p>
                      </section>

                      <section className="space-y-6">
                         <h5 className="font-bold text-slate-900 text-2xl flex items-center gap-2">
                            <ShieldCheck className="w-7 h-7 text-green-500" /> สถานะความปลอดภัย
                         </h5>
                         <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 space-y-4">
                            {[
                              "ข้อมูลถูกเข้ารหัสแบบ End-to-End Encryption",
                              "จัดเก็บเป็นพยานหลักฐานดิจิทัลตามมาตรฐานธรรมาภิบาล",
                              "เข้าถึงได้เฉพาะผู้มีส่วนเกี่ยวข้องในคดีนี้เท่านั้น"
                            ].map((log, i) => (
                              <div key={i} className="flex items-center gap-4 text-lg text-slate-600">
                                 <CheckCircle2 className="w-5 h-5 text-green-500" /> {log}
                              </div>
                            ))}
                         </div>
                      </section>
                   </div>

                   <div className="space-y-10">
                      <Card className="shadow-sm border-slate-100 bg-slate-50/50 p-8 rounded-[2.5rem] border-none">
                         <CardHeader className="p-0 mb-6">
                            <CardTitle className="text-xl">Metadata คดีความ</CardTitle>
                         </CardHeader>
                         <CardContent className="p-0 space-y-8">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-4 text-xl">
                                  <Clock className="w-6 h-6 text-slate-400" />
                                  <span className="text-slate-600 font-bold italic">{selectedEvent.time}</span>
                               </div>
                               <Badge className="bg-blue-600 font-bold text-sm px-4 py-1">{selectedEvent.date}</Badge>
                            </div>
                            <div className="pt-8 border-t border-slate-200">
                               <p className="text-xs uppercase font-bold text-slate-400 tracking-widest mb-4">เจ้าหน้าที่ผู้ดำเนินการ</p>
                               <div className="flex items-center gap-4">
                                  <Avatar className="w-14 h-14 border-4 border-white shadow-xl">
                                     <AvatarImage src="/pic/lawyer-avatar.png" />
                                     <AvatarFallback>ทก</AvatarFallback>
                                  </Avatar>
                                  <div>
                                     <p className="text-lg font-bold text-slate-900">ทนายเกียรติศักดิ์</p>
                                     <p className="text-xs text-slate-400 uppercase font-black">Lead Prosecution</p>
                                  </div>
                               </div>
                            </div>
                         </CardContent>
                      </Card>

                      <div className="flex flex-col gap-4">
                         <Button className="w-full h-16 rounded-[2rem] bg-slate-900 hover:bg-black font-bold shadow-2xl text-lg" onClick={() => setSelectedEvent(null)}>
                            ปิดหน้าต่างนี้
                         </Button>
                         <Button variant="ghost" className="w-full text-red-400 font-bold hover:text-red-600" onClick={() => setSelectedEvent(null)}>
                            ลบหรือแก้ไขข้อมูล (Admin Only)
                         </Button>
                      </div>
                   </div>
                </div>
              </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSubView === 'document' && viewingDoc) {
    return (
      <div className="bg-slate-900 h-screen flex flex-col animate-in zoom-in-95 duration-500 overflow-hidden relative">
          {/* Privacy Overlay */}
          {!isFocused && !isVerifying && (
            <div className="absolute inset-0 z-[100] bg-slate-900/95 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-12">
               <ShieldCheck className="w-32 h-32 text-blue-500 mb-8 animate-pulse shadow-2xl shadow-blue-500/20" />
               <h1 className="text-4xl font-black text-white mb-4 tracking-tighter italic uppercase">PROTECTION ACTIVE</h1>
               <p className="text-blue-300/60 text-xl max-w-lg leading-relaxed">
                  เนื้อหาถูกซ่อนเนื่องจากคุณไม่ได้อยู่ในหน้าจอหลัก เพื่อป้องกันการบันทึกภาพหน้าจอหรือความปลอดภัยระหว่างใช้งาน
               </p>
               <Button className="mt-12 bg-blue-600 rounded-full px-12 h-14 font-black shadow-xl" onClick={() => setIsFocused(true)}>คลิกเพื่อแสดงเนื้อหา</Button>
            </div>
          )}

          {/* Secure Header */}
          <div className="h-24 bg-black/40 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-12 relative z-50">
             <div className="flex items-center gap-6">
                <Button variant="ghost" className="text-white h-12 w-12 rounded-full hover:bg-white/10" onClick={() => setViewingDoc(null)}>
                   <ArrowLeft className="w-6 h-6" />
                </Button>
                <div>
                   <h2 className="text-2xl font-bold text-white tracking-tight">{viewingDoc.name}</h2>
                   <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest flex items-center gap-2">
                       <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> RECORDED SECURE VIEW • {viewingDoc.category}
                   </p>
                </div>
             </div>
             <div className="flex items-center gap-4">
                <Badge className="bg-blue-600/20 text-blue-400 border border-blue-500/30">HIGH CONFIDENTIALITY</Badge>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                   <Info className="w-5 h-5" />
                </div>
             </div>
          </div>

          <div className="flex-1 relative flex items-center justify-center overflow-auto p-12 select-none" onContextMenu={(e) => e.preventDefault()}>
             {isVerifying ? (
               <div className="text-center space-y-6">
                  <div className="relative w-24 h-24 mx-auto">
                     <Loader2 className="w-24 h-24 text-blue-500 animate-spin opacity-20" />
                     <ShieldCheck className="w-12 h-12 text-blue-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <h3 className="text-white font-bold text-xl font-headline italic uppercase tracking-widest animate-pulse">Authorizing Vault Access...</h3>
               </div>
             ) : (
               <div className="w-full max-w-4xl bg-white shadow-[0_0_100px_rgba(0,0,0,0.5)] p-20 space-y-12 relative overflow-hidden pointer-events-none mb-20 origin-top animate-in slide-in-from-top-12 duration-700">
                  {/* Dynamic Watermark Pattern */}
                  <motion.div 
                    animate={{ 
                      x: [0, 10, 0, -10, 0],
                      y: [0, 20, 0, -20, 0]
                    }}
                    transition={{ 
                      duration: 20, 
                      repeat: Infinity,
                      ease: "linear"
                    }}
                    className="absolute inset-0 grid grid-cols-2 grid-rows-4 opacity-[0.03] rotate-[-25deg] pointer-events-none select-none"
                  >
                     {[...Array(8)].map((_, i) => (
                       <p key={i} className="text-5xl font-black font-headline self-center justify-self-center text-slate-900 uppercase tracking-tighter">LAWSLANE SECURE ASSET</p>
                     ))}
                  </motion.div>
                  
                  <div className="flex justify-between items-start border-b-8 border-slate-900 pb-10">
                     <h1 className="text-6xl font-black text-slate-900 uppercase italic tracking-tighter leading-[0.8]">
                        LAWSLANE<br/><span className="text-4xl text-slate-500 font-bold ml-1">OFFICIAL VIEW</span>
                     </h1>
                     <div className="text-right text-slate-400 font-bold uppercase text-[10px] tracking-widest leading-relaxed">
                        Document ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}<br/>
                        Verified: {format(new Date(), 'dd/MM/yyyy HH:mm')}
                     </div>
                  </div>

                  <div className="space-y-10 pt-10">
                     <p className="text-slate-900 font-bold leading-relaxed text-lg italic border-l-4 border-blue-600 pl-6">
                        โดยที่คดีนี้เป็นข้อพิพาทเกี่ยวกับ <span className="bg-slate-900 text-white px-2 not-italic">PROPERTY_DISPUTE_042</span> ตามที่โจทก์ได้ยื่นฟ้องต่อศาลแพ่ง...
                     </p>
                     
                     <div className="space-y-6">
                        {[
                          "ข้อเท็จจริงประการที่หนึ่ง พบว่าจำเลยมีพฤติการณ์อันเป็นการผิดสัญญาจ้างทำของ โดยมิได้ส่งมอบงานตามกำหนดเวลาที่ระบุไว้ในสัญญาข้อ ๔.๒...",
                          "ในการนี้ โจทก์ได้มีหนังสือบอกกล่าวทวงถามไปยังจำเลยแล้วจำนวน ๓ ครั้ง แต่จำเลยยังคงเพิกเฉยไม่ดำเนินการแก้ไขให้ถูกต้องตามสัญญา...",
                          "อนึ่ง พยานหลักฐานดิจิทัลที่ปรากฏในระบบ Lawslane นี้ ได้รับการรับรองความถูกต้องตามพระราชบัญญัติว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์...",
                          "จึงขอให้ศาลได้โปรดพิจารณาพยานหลักฐานดังกล่าวประกอบการพิจารณาพิพากษาคดี เพื่อประโยชน์แห่งความยุติธรรมต่อไป"
                        ].map((text, i) => (
                          <div key={i} className="relative group/line">
                             <p className={cn(
                               "text-slate-600 leading-loose text-base font-medium transition-all group-hover/line:text-slate-900",
                               i === 1 ? "blur-[1.5px] hover:blur-none transition-all duration-700" : ""
                             )}>
                               {text}
                             </p>
                             {i === 1 && (
                               <div className="absolute -right-4 top-0 h-full flex items-center">
                                  <div className="bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded rotate-90 origin-right">CLEARED</div>
                               </div>
                             )}
                          </div>
                        ))}
                     </div>
                     
                     <div className="space-y-4 pt-4 opacity-40">
                        <div className="h-4 bg-slate-100 rounded-full w-[85%]"></div>
                        <div className="h-4 bg-slate-100 rounded-full w-[90%]"></div>
                        <div className="h-4 bg-slate-100 rounded-full w-[70%]"></div>
                     </div>
                  </div>
                  
                  <div className="pt-20 text-center opacity-20">
                     <p className="text-xs font-black uppercase tracking-[0.5em] text-slate-900 font-headline italic">Internal Legal Record - Do Not Share</p>
                  </div>
               </div>
             )}
          </div>
          
          {/* Footer controls */}
          <div className="h-24 bg-black/60 backdrop-blur-md border-t border-white/5 flex items-center justify-center px-12 gap-8 shrink-0 z-50">
              <Button className="rounded-full h-14 px-12 font-black bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/40" onClick={() => setViewingDoc(null)}>
                 ปิดหน้านี้อย่างปลอดภัย
              </Button>
          </div>
      </div>
    );
  }

  if (activeSubView === 'evidence' && selectedEvidence) {
    return (
      <div className="bg-slate-50 min-h-screen pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="container mx-auto max-w-6xl px-4 pt-12 space-y-8">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="sm" onClick={() => setSelectedEvidence(null)} className="text-slate-400 hover:text-slate-900 group">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> คลังพยานหลักฐานหลัก
             </Button>
             <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
             <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Evidence Asset Repository</span>
          </div>

          <div className="rounded-[3rem] overflow-hidden shadow-2xl bg-white border border-slate-100 flex flex-col min-h-[80vh]">
              <div className="h-64 bg-slate-900 bg-[url('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=2070')] bg-cover bg-center relative flex items-center px-16 group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent"></div>
                <div className="z-10 flex items-center gap-12">
                    <div className="w-28 h-28 rounded-[2rem] bg-blue-600 flex items-center justify-center shadow-2xl border-4 border-blue-500/20 group-hover:scale-110 transition-transform duration-700">
                        <Gavel className="w-12 h-12 text-white" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-6xl font-black font-headline text-white tracking-tighter italic">{selectedEvidence.title}</h1>
                        <div className="flex items-center gap-4">
                            <Badge className="bg-blue-600 font-black text-xs px-6 py-1 h-8 rounded-full shadow-lg shadow-blue-900/20">{selectedEvidence.count} VERIFIED ASSETS</Badge>
                            <span className="text-blue-400/60 uppercase text-xs font-black tracking-widest italic">• SECURE STORAGE Lvl. 4 •</span>
                        </div>
                    </div>
                </div>
              </div>

              <div className="p-16 flex-1 bg-white space-y-16">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                     {[...Array(12)].map((_, i) => (
                       <div key={i} className="aspect-[3/4] rounded-[2rem] bg-slate-50 border border-slate-100 flex flex-col items-center justify-center group cursor-pointer hover:bg-white hover:border-blue-400 hover:shadow-[0_20px_50px_rgba(59,130,246,0.15)] transition-all relative overflow-hidden">
                          <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0 translate-x-4">
                             <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg">
                                <ExternalLink className="w-5 h-5" />
                             </div>
                          </div>
                          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-200 group-hover:text-blue-500 group-hover:scale-125 transition-all shadow-sm">
                             <FileText className="w-8 h-8" />
                          </div>
                          <div className="mt-8 text-center space-y-1">
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] group-hover:text-blue-400 transition-colors">EVIDENCE_REF</p>
                             <p className="text-sm font-black text-slate-900 italic tracking-tighter">ASSET_ITEM_{i+1001}</p>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-blue-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       </div>
                     ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-16 pt-16 border-t border-slate-100">
                      <div className="md:col-span-2 space-y-6">
                         <h5 className="font-bold text-slate-900 text-2xl flex items-center gap-3">
                            <Info className="w-8 h-8 text-blue-500 animate-pulse" /> บันทึกวิเคราะห์พยานหลักฐาน (AI Legal Review)
                         </h5>
                         <p className="text-slate-500 leading-loose italic text-xl">
                            "ชุดพยานนี้ถูกจัดลำดับความสำคัญในระดับ High Priority ทางทนายความได้ทำการตรวจสอบความถูกต้องของ Meta Information เรียบร้อยแล้ว พร้อมสำหรับการจัดทำบัญชีระบุพยานเพื่อยื่นต่อศาลในกระบวนการถัดไป..."
                         </p>
                      </div>
                      <div className="flex flex-col justify-end gap-4">
                         <Button className="rounded-2xl h-16 px-10 font-black bg-slate-900 hover:bg-black text-white shadow-2xl text-lg group">
                            ยื่นหลักฐานต่อศาลดิจิทัล <Gavel className="w-5 h-5 ml-2 group-hover:rotate-[30deg] transition-transform" />
                         </Button>
                         <Button variant="ghost" className="rounded-2xl h-14 px-10 font-bold text-slate-400 hover:text-slate-900" onClick={() => setSelectedEvidence(null)}>
                            ปิดหน้าต่างพยานหลักฐาน
                         </Button>
                      </div>
                  </div>
              </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSubView === 'witness' && showWitnessList) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col animate-in fade-in duration-500 pb-20">
        {/* Progress Header - Scaled Down and Sticky */}
        <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
           <div className="container mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
              <button 
                onClick={() => { setShowWitnessList(false); setWitnessStep(0); }} 
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-xs group"
              >
                 <ArrowLeft className="w-4 h-4" />
                 <span>กลับสู่แดชบอร์ด</span>
              </button>
              
              <div className="flex items-center gap-6">
                 {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center gap-2">
                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm transition-all ${witnessStep >= step ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                          {witnessStep > step ? <Check className="w-4 h-4" /> : step}
                       </div>
                       <span className={`text-[10px] font-black uppercase tracking-widest hidden sm:block ${witnessStep >= step ? 'text-slate-900' : 'text-slate-300'}`}>
                          {step === 1 ? 'SELECT EVIDENCE' : step === 2 ? 'LEGAL FACTS' : 'E-SIGNATURE'}
                       </span>
                       {step < 3 && <div className={`w-4 h-0.5 rounded-full mx-1 ${witnessStep > step ? 'bg-blue-600' : 'bg-slate-200'}`} />}
                    </div>
                 ))}
              </div>

              <div className="w-20 hidden md:block" /> 
           </div>
        </div>

        <div className="flex-1 container mx-auto max-w-4xl py-12 px-6">
           {/* Step 0: Intro */}
           {witnessStep === 0 && (
             <div className="max-w-xl mx-auto text-center space-y-8 animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                   <ShieldCheck className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-3">
                   <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-tight">
                      เริ่มการสร้าง <span className="text-blue-600">บัญชีระบุพยาน</span>
                   </h1>
                   <p className="text-slate-500 text-sm px-6">
                      ระบบจะช่วยทนายความในการคัดเลือกพยานหลักฐานและจัดทำร่างข้อเท็จจริงเพื่อความแม่นยำทางกฎหมาย
                   </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm text-left">
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-3">
                         <Gavel className="w-4 h-4" />
                      </div>
                      <p className="font-bold text-slate-900 text-xs">แม่นยำตามกฎหมาย</p>
                   </div>
                   <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm text-left">
                      <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-600 mb-3">
                         <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <p className="font-bold text-slate-900 text-xs">พร้อมลงนามดิจิทัล</p>
                   </div>
                </div>
                <Button 
                   className="w-full h-16 rounded-2xl bg-blue-600 text-lg font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all text-white italic uppercase tracking-tighter"
                   onClick={() => setWitnessStep(1)}
                >
                   เริ่มดำเนินการตอนนี้ <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
             </div>
           )}

           {/* Step 1: Selection */}
           {witnessStep === 1 && (
             <div className="space-y-8 animate-in fade-in duration-500">
                <div className="space-y-2">
                   <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">1. คัดเลือกพยานหลักฐาน</h2>
                   <p className="text-slate-500 text-sm italic">เลือกพยานเอกสารหรือพยานบุคคลที่เกี่ยวข้องในคดีนี้</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {[ 
                     { label: "พยานเอกสาร", status: "คัดเลือกแล้ว 4 รายการ", color: "text-blue-600", active: true, id: 'docs' },
                     { label: "พยานบุคคล", status: witnessPersons.length > 0 ? `คัดเลือกแล้ว ${witnessPersons.length} รายการ` : "ยังไม่ได้เลือก", color: witnessPersons.length > 0 ? "text-blue-600" : "text-slate-400", active: witnessPersons.length > 0, id: 'witness' },
                     { label: "พยานเทคโนโลยี", status: "คัดเลือกแล้ว 2 รายการ", color: "text-green-500", active: true, id: 'tech' },
                     { label: "วัตถุพยาน", status: "ยังไม่ได้ระบุ", color: "text-slate-400", active: false, id: 'physical' }
                   ].map((item, i) => (
                     <div 
                       key={i} 
                       className={`p-6 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center ${item.active ? 'border-blue-600 bg-white shadow-md' : 'border-white bg-white shadow-sm hover:border-blue-200'}`}
                       onClick={() => item.id === 'witness' && setShowAddWitnessForm(true)}
                     >
                        <div>
                           <h4 className="font-black text-slate-900 tracking-tighter uppercase italic">{item.label}</h4>
                           <p className={`text-[10px] font-bold ${item.color} uppercase tracking-wider`}>{item.status}</p>
                        </div>
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${item.active ? 'bg-blue-600 border-blue-600 shadow-sm' : 'border-slate-100'}`}>
                           {item.active && <Check className="w-4 h-4 text-white" />}
                        </div>
                     </div>
                   ))}
                </div>

                {witnessPersons.length > 0 && (
                  <div className="bg-slate-100/50 p-6 rounded-3xl border border-slate-100 space-y-4">
                     <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">รายชื่อพยานบุคคล</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {witnessPersons.map((wp, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-400 transition-all cursor-pointer group"
                            onClick={() => {
                              setNewWitness(wp);
                              setEditingWitnessIndex(idx);
                              setShowAddWitnessForm(true);
                            }}
                          >
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                   <User className="w-4 h-4" />
                                </div>
                                <div>
                                   <p className="font-bold text-slate-900 text-sm">{wp.name}</p>
                                   <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{wp.role}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 group-hover:text-blue-500">
                                   <FileText className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500" onClick={(e) => {
                                   e.stopPropagation();
                                   setWitnessPersons(prev => prev.filter((_, i) => i !== idx));
                                }}>
                                   <Trash2 className="w-4 h-4" />
                                </Button>
                             </div>
                          </div>
                        ))}
                     </div>
                  </div>
                )}

                <div className="pt-4 flex gap-4">
                   <Button 
                      variant="ghost"
                      className="h-16 px-8 rounded-2xl font-bold text-slate-400 hover:text-slate-900"
                      onClick={() => setWitnessStep(0)}
                   >
                      ย้อนกลับ
                   </Button>
                   <Button 
                      className="flex-1 h-16 rounded-2xl bg-blue-600 text-lg font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all text-white italic uppercase tracking-tighter"
                      onClick={() => {
                          setWitnessStep(2);
                          setShowAddWitnessForm(false);
                       }}
                   >
                      ขั้นตอนถัดไป <ChevronRight className="ml-2 w-5 h-5" />
                   </Button>
                </div>
             </div>
           )}

           {/* Step 2: Facts */}
           {witnessStep === 2 && (
             <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
                <div className="space-y-2">
                   <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">2. ระบุข้อเท็จจริงที่ต้องการนำสืบ</h2>
                   <p className="text-slate-500 text-sm italic">จัดเตรียมร่างข้อความเพื่อใช้ในการพิจารณาคดี</p>
                </div>

                <div className="space-y-4">
                   {[
                     { id: "EV-1021", title: "สัญญาจ้างเหมาก่อสร้างเลขที่ 12/2567", fact: "เพื่อพิสูจน์ว่าจำเลยได้ทำสัญญาจ้างกับโจทก์และได้รับเงินมัดจำไปจริงตามหลักฐานรายการโอนเงิน...", type: 'EVIDENCE' },
                     { id: "EV-1045", title: "บันทึกสนทนาแอปพลิเคชัน LINE (Screenshot)", fact: "พยานหลักฐานดิจิทัลนี้ใช้พิสูจน์ถึงเจตนาในการเลี่ยงการส่งมอบงานและการขาดการติดต่อสื่อสารที่มีลักษณะทุจริต...", type: 'EVIDENCE' },
                     ...witnessPersons.map((wp, idx) => ({
                       id: `WP-${2001 + idx}`,
                       title: `พยานบุคคล: ${wp.name}`,
                       fact: `เพื่อพิสูจน์ในประเด็น: ${wp.role} ของพยานในเหตุการณ์ที่มุ่งเน้นความเป็นธรรม...`,
                       type: 'WITNESS'
                     }))
                    ].map((fact, i) => (
                      <div key={i} className="p-6 rounded-3xl bg-white border border-slate-200 flex flex-col gap-4 shadow-sm hover:border-blue-400 transition-all group">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white shadow-md ${fact.type === 'WITNESS' ? 'bg-amber-600' : 'bg-slate-900 group-hover:bg-blue-600'}`}>
                                   <p className="text-[7px] uppercase font-bold text-white/50 leading-none mb-0.5">IDREF</p>
                                   <p className="text-xs font-black italic">{fact.id}</p>
                                </div>
                                <div className="space-y-0.5">
                                   <h5 className="font-black text-slate-900 tracking-tighter italic text-base">{fact.title}</h5>
                                   <span className={`text-[9px] font-bold uppercase tracking-widest italic flex items-center gap-1.5 ${fact.type === 'WITNESS' ? 'text-amber-500' : 'text-blue-500'}`}>
                                      <ShieldCheck className="w-3 h-3" /> {fact.type === 'WITNESS' ? 'VERIFIED WITNESS' : 'VERIFIED EVIDENCE'}
                                   </span>
                                </div>
                             </div>
                             <Button 
                               variant="ghost" 
                               size="sm" 
                               className="h-8 text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 flex items-center gap-2"
                               onClick={() => {
                                 setEditingFactIndex(i);
                                 setTempFact(fact.fact);
                               }}
                             >
                                <FileText className="w-3.5 h-3.5" /> แก้ไขรายละเอียด
                             </Button>
                          </div>
                          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 italic text-sm text-slate-500 leading-relaxed relative">
                             <div className="absolute top-0 right-4 -translate-y-1/2 px-3 py-1 bg-white border border-slate-100 rounded-full flex items-center gap-2 text-[9px] font-black uppercase text-slate-400 tracking-widest italic shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> AI DRAFT
                             </div>
                             {editingFactIndex === i ? (
                               <div className="space-y-4">
                                  <textarea 
                                    className="w-full bg-white p-4 rounded-xl border border-blue-100 text-sm font-medium focus:ring-4 ring-blue-500/5 outline-none min-h-[100px] not-italic"
                                    value={tempFact}
                                    onChange={(e) => setTempFact(e.target.value)}
                                  />
                                  <div className="flex gap-2 justify-end">
                                     <Button variant="ghost" size="sm" onClick={() => setEditingFactIndex(null)}>ยกเลิก</Button>
                                     <Button size="sm" className="bg-blue-600 text-white" onClick={() => {
                                        setEditingFactIndex(null);
                                        toast({ title: "อัปเดตข้อมูลสำเร็จ", description: "ข้อมูลข้อเท็จจริงได้รับการบันทึกแล้ว" });
                                     }}>บันทึก</Button>
                                  </div>
                               </div>
                             ) : (
                               `"${fact.fact}"`
                             )}
                          </div>
                      </div>
                    ))}
                </div>

                <div className="pt-4 flex gap-4">
                   <Button 
                      variant="ghost"
                      className="h-16 px-8 rounded-2xl font-bold text-slate-400 hover:text-slate-900"
                      onClick={() => setWitnessStep(1)}
                   >
                      ย้อนกลับ
                   </Button>
                   <Button 
                      className="flex-1 h-16 rounded-2xl bg-blue-600 text-lg font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all text-white italic uppercase tracking-tighter"
                      onClick={() => setWitnessStep(3)}
                   >
                      ขั้นตอนถัดไป <ChevronRight className="ml-2 w-5 h-5" />
                   </Button>
                </div>
             </div>
           )}

           {/* Step 3: Signature */}
            {witnessStep === 3 && (
              <div className="max-w-4xl mx-auto space-y-12 animate-in zoom-in-95 duration-500 pb-20">
                 <div className="text-center space-y-3">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">3. ตรวจสอบและลงนาม</h2>
                    <p className="text-slate-500 text-sm italic">ยืนยันความถูกต้องเพื่อจัดทำบัญชีพยาน (Witness List Form 11)</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Document Preview Card */}
                    <div className="p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-xl space-y-6 relative overflow-hidden group">
                       <div className="aspect-[1/1.4] bg-slate-50 border border-slate-200 rounded-2xl flex flex-col p-8 space-y-4 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent pointer-events-none" />
                          <div className="w-full h-4 bg-slate-200/50 rounded-full w-2/3" />
                          <div className="w-full h-3 bg-slate-100/50 rounded-full" />
                          <div className="w-full h-3 bg-slate-100/50 rounded-full" />
                          <div className="w-full h-3 bg-slate-100/50 rounded-full" />
                          <div className="w-full h-4 bg-slate-200/50 rounded-full w-1/2 pt-8" />
                          <div className="w-full h-3 bg-slate-100/50 rounded-full ml-8" />
                          <div className="w-full h-3 bg-slate-100/50 rounded-full ml-8" />
                          <div className="w-full h-3 bg-slate-100/50 rounded-full ml-12" />
                          <div className="pt-20 mt-auto flex justify-end">
                             <div className="w-32 h-12 border-b-2 border-slate-200 relative">
                                {isSigned && (
                                   <motion.div 
                                     initial={{ opacity: 0, scale: 0.5 }} 
                                     animate={{ opacity: 1, scale: 1 }}
                                     className="absolute bottom-1 inset-x-0 text-center text-blue-700 italic font-serif text-xl"
                                   >
                                     {caseData.lawyerName || 'Krittameth.V'}
                                   </motion.div>
                                )}
                             </div>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/40 backdrop-blur-[2px]">
                             <Button variant="secondary" size="sm" className="rounded-full shadow-lg font-bold">ขยายดูฉบับร่าง</Button>
                          </div>
                       </div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center italic">PREVIEW: WITNESS_LIST_V2.PDF</p>
                    </div>

                    {/* Signature Pad Card */}
                    <div className={cn(
                      "p-10 rounded-[3rem] bg-white shadow-2xl transition-all duration-700 space-y-10 flex flex-col justify-center border-2",
                      isSigned ? "border-green-500 ring-8 ring-green-500/5" : "border-blue-600 ring-8 ring-blue-500/5"
                    )}>
                       <div className="space-y-6">
                          <div className="flex items-center justify-between">
                             <div className="space-y-1">
                                <h4 className="text-sm font-black text-slate-900 tracking-tighter uppercase italic">Digital Signature Pad</h4>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest flex items-center gap-1.5">
                                   <ShieldCheck className="w-3 h-3 text-blue-500" /> Secure Encryption Active
                                </p>
                             </div>
                             {isSigned && <Badge className="bg-green-500 text-[8px] font-black uppercase italic h-5 animate-in zoom-in">SIGNED ✓</Badge>}
                          </div>

                          <div 
                            className={cn(
                              "h-56 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center relative cursor-crosshair group overflow-hidden transition-all duration-500",
                              isSigned ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50"
                            )}
                            onClick={() => setIsSigned(true)}
                          >
                             {isSigned ? (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }} 
                                  animate={{ opacity: 1, y: 0 }}
                                  className="text-blue-700 italic font-serif text-5xl select-none tracking-tighter"
                                >
                                  {caseData.lawyerName || 'Krittameth.V'}
                                </motion.div>
                             ) : (
                                <div className="flex flex-col items-center gap-4 group-hover:scale-110 transition-transform duration-500">
                                   <div className="w-16 h-16 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover:shadow-blue-500/20">
                                      <Plus className="w-6 h-6 text-slate-300 group-hover:text-blue-500" />
                                   </div>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic group-hover:text-blue-600">คลิกเพื่อลงนามดิจิทัล</p>
                                </div>
                             )}
                             <div className="absolute inset-x-8 bottom-6 flex justify-between items-center opacity-30">
                                <span className="text-[10px] font-black italic">X_______________________</span>
                                {isSigned && (
                                  <span className="text-[8px] font-mono font-bold">SHA-256: {Math.random().toString(16).substr(2, 6).toUpperCase()}</span>
                                )}
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-2 justify-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                             <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Verified Identity: {caseData.lawyerName || 'ทนายความผู้รับผิดชอบ'}</p>
                          </div>
                       </div>

                       <div className="space-y-4 pt-4">
                          <Button 
                             className={cn(
                                "w-full h-16 rounded-2xl text-lg font-black shadow-2xl transition-all italic uppercase tracking-tighter flex items-center justify-center gap-3",
                                isSigned 
                                  ? "bg-slate-900 hover:bg-black text-white shadow-slate-200" 
                                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
                             )}
                             disabled={!isSigned}
                             onClick={() => {
                               toast({
                                 title: "จัดทำบัญชีพยานสำเร็จ",
                                 description: "ระบบกำลังเตรียมเอกสารฉบับลงนาม...",
                               });
                               setShowWitnessList(false);
                               setWitnessStep(0);
                               setActiveSubView(null);
                             }}
                          >
                             ยืนยันและประกาศใช้ <Check className="w-6 h-6" />
                          </Button>
                          <Button 
                             variant="ghost" 
                             className="w-full h-10 rounded-xl font-bold text-slate-400 hover:text-red-500 text-xs transition-colors"
                             onClick={() => setIsSigned(false)}
                          >
                             ล้างลายเซ็นและลงนามใหม่
                          </Button>
                       </div>
                    </div>
                 </div>

                 <Button 
                    variant="ghost" 
                    className="w-full h-14 rounded-2xl font-bold text-slate-400 hover:text-slate-900 flex items-center justify-center gap-2 hover:bg-slate-100/50"
                    onClick={() => setWitnessStep(2)}
                 >
                    <ArrowLeft className="w-4 h-4" /> ย้อนกลับไปตรวจสอบข้อเท็จจริง
                 </Button>
              </div>
            )}
        </div>

        {/* Add Witness Modal Overlay - Standard Size */}
        {showAddWitnessForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-sm animate-in fade-in duration-300">
             <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 space-y-6 animate-in zoom-in-95">
                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic text-center">
                   {editingWitnessIndex !== null ? 'แก้ไขข้อมูลพยาน' : 'เพิ่มพยานบุคคล'}
                </h3>
                <div className="space-y-3">
                   <input 
                     className="w-full h-12 px-5 rounded-xl bg-slate-100 border-none text-sm font-bold outline-none ring-blue-500/10 focus:ring-4 transition-all" 
                     placeholder="ชื่อ-นามสกุล พยาน"
                     value={newWitness.name}
                     onChange={(e) => setNewWitness({...newWitness, name: e.target.value})}
                   />
                   <input 
                     className="w-full h-12 px-5 rounded-xl bg-slate-100 border-none text-sm font-bold outline-none ring-blue-500/10 focus:ring-4 transition-all" 
                     placeholder="บทบาท (เช่น ประจักษ์พยาน)"
                     value={newWitness.role}
                     onChange={(e) => setNewWitness({...newWitness, role: e.target.value})}
                   />
                </div>
                <div className="flex gap-3">
                   <Button variant="ghost" className="flex-1 h-12 rounded-xl font-bold text-slate-400" onClick={() => {
                      setShowAddWitnessForm(false);
                      setEditingWitnessIndex(null);
                      setNewWitness({ name: '', role: '' });
                   }}>ยกเลิก</Button>
                   <Button 
                     className="flex-1 h-12 rounded-xl bg-blue-600 font-black text-white shadow-md shadow-blue-100"
                     onClick={() => {
                        if (newWitness.name && newWitness.role) {
                          if (editingWitnessIndex !== null) {
                            const updated = [...witnessPersons];
                            updated[editingWitnessIndex] = newWitness;
                            setWitnessPersons(updated);
                          } else {
                            setWitnessPersons([...witnessPersons, newWitness]);
                          }
                          setNewWitness({ name: '', role: '' });
                          setEditingWitnessIndex(null);
                          setShowAddWitnessForm(false);
                        }
                     }}
                   >
                     {editingWitnessIndex !== null ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
                   </Button>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-20 animate-in fade-in duration-700">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Header Banner */}
        <div className="bg-white border-b border-slate-200 pt-8 pb-4 sticky top-0 z-10 shadow-sm">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
              <Link href="/lawyer-dashboard" className="hover:text-blue-600 transition-colors">แดชบอร์ด</Link>
              <span>/</span>
              <span className="text-slate-900 font-medium">จัดการคดี</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 font-headline italic tracking-tight uppercase">
                    {caseData.title}
                  </h1>
                  <Badge variant={caseData.status === 'closed' ? 'secondary' : 'default'} className="rounded-full">
                    {caseData.status === 'active' ? 'กำลังดำเนินการ' : 'ปิดคดีแล้ว'}
                  </Badge>
                </div>
                <p className="text-slate-500 text-sm flex items-center gap-2">
                  <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">CASE-ID: {caseData.id}</span>
                  <span>•</span>
                  <span>เริ่มเมื่อ {format(caseData.updatedAt, 'd MMM yyyy', { locale: th })}</span>
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => router.push(`/chat/${caseData.id}`)}>
                  <MessageSquare className="w-4 h-4 mr-2" /> แชทกับลูกความ
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-md">
                  <Plus className="w-4 h-4 mr-2" /> เพิ่มกิจกรรมใหม่
                </Button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="mt-8">
              <TabsList className="bg-transparent border-b border-transparent p-0 gap-6 h-auto">
                <TabsTrigger value="overview" className="border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-1 pb-4 pt-0 shadow-none font-bold">สรุปภาพรวม</TabsTrigger>
                <TabsTrigger value="timeline" className="border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-1 pb-4 pt-0 shadow-none font-bold">ไทม์ไลน์คดี</TabsTrigger>
                <TabsTrigger value="documents" className="border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-1 pb-4 pt-0 shadow-none font-bold">เอกสารทางกฎหมาย</TabsTrigger>
                <TabsTrigger value="evidence" className="border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-1 pb-4 pt-0 shadow-none font-bold">พยานหลักฐาน</TabsTrigger>
                <TabsTrigger value="billing" className="border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-1 pb-4 pt-0 shadow-none font-bold">การเงินและค่าธรรมเนียม</TabsTrigger>
                <TabsTrigger value="research" className="border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-1 pb-4 pt-0 shadow-none font-bold flex items-center gap-1">
                  <BrainCircuit className="w-4 h-4 text-blue-600" /> ค้นคว้าข้อกฎหมาย (AI)
                </TabsTrigger>
                <TabsTrigger value="interpreters" className="border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-1 pb-4 pt-0 shadow-none font-bold flex items-center gap-1">
                  <Globe className="w-4 h-4 text-indigo-600" /> ค้นหาล่ามกฎหมาย
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        <div className="container mx-auto max-w-6xl px-4 mt-8">
          {/* Overview TabContent is default, but we use it inside the Tabs system properly */}
          <TabsContent value="overview" className="m-0 space-y-8 pb-20">
            {/* Visual Case Roadmap Section */}
            <FadeIn>
              <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] border border-white/40 shadow-2xl overflow-hidden p-1">
                 <CaseRoadmap 
                   currentStep={currentStep} 
                   className="border-none shadow-none bg-transparent" 
                   steps={milestones.length > 0 ? milestones.map((m, i) => ({ 
                     id: i + 1, 
                     label: m.title, 
                     icon: i === 0 ? Scale : (i === 1 ? FileText : (i === 2 ? Gavel : (i === 3 ? CheckCircle2 : Gavel))),
                     date: m.dueDate ? format(m.dueDate, 'dd MMM', { locale: th }) : undefined
                   })) : undefined}
                 />
              </div>
            </FadeIn>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="rounded-[2.5rem] border-white/40 bg-white/70 backdrop-blur-md shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-500">
                  <CardHeader className="bg-gradient-to-br from-blue-600/5 to-indigo-600/5">
                    <CardTitle className="text-sm font-black italic uppercase tracking-tighter flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-600" /> สถานะและความคืบหน้าปัจจุบัน
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm mb-1 uppercase tracking-tighter font-bold">
                        <span className="text-slate-500">ความสำเร็จของเป้าหมาย (Milestones)</span>
                        <span className="text-blue-600">{completedMilestones} จาก {totalMilestones} ขั้นตอน</span>
                      </div>
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full shadow-sm transition-all duration-1000"
                          style={{ width: `${totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0}%` }}
                        ></div>
                      </div>
                      
                      <div className="grid gap-3 pt-4">
                        {milestones.length > 0 ? (
                          milestones.map((m, i) => (
                            <div key={m.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${m.status === 'completed' ? 'border-green-100 bg-green-50/30' : 'border-slate-100 bg-white'}`}>
                              <div className="flex items-center gap-4">
                                <div 
                                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm cursor-pointer ${m.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}
                                  onClick={() => handleToggleMilestone(m.id)}
                                >
                                  {m.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                </div>
                                <div>
                                  <h4 className={`text-sm font-bold ${m.status === 'completed' ? 'text-slate-900' : 'text-slate-600'}`}>{m.title}</h4>
                                  <p className="text-xs text-slate-400">
                                    {m.dueDate ? format(m.dueDate, 'dd MMM yy', { locale: th }) : 'ยังไม่นัดวัน'}
                                  </p>
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" className="text-slate-300 hover:text-slate-600">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10 text-slate-400 italic text-sm">
                            ยังไม่มี Milestone สำหรับคดีนี้
                          </div>
                        )}
                        
                        <Button 
                          variant="ghost" 
                          className="w-full mt-2 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 hover:border-blue-200 hover:text-blue-600 h-14"
                          onClick={() => {
                             const title = prompt('ระบุชื่อ Milestone ใหม่');
                             if (title) handleAddMilestone(id, title);
                          }}
                        >
                           <Plus className="w-4 h-4 mr-2" /> เพิ่ม Milestone ใหม่
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <Card className="shadow-sm border-slate-200 overflow-hidden">
                  <div className="h-2 bg-blue-600"></div>
                  <CardHeader>
                    <CardTitle className="text-lg">ลูกความผู้รับผิดชอบ</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center pb-6">
                    <Avatar className="h-24 w-24 mx-auto mb-4 border-4 border-white shadow-xl ring-1 ring-slate-100">
                      <AvatarImage src={caseData.clientAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${caseData.clientName}`} />
                      <AvatarFallback className="bg-slate-100 text-slate-400">{caseData.clientName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <h4 className="font-bold text-xl text-slate-900 mb-1">{caseData.clientName}</h4>
                    <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold mb-6">
                      <User className="w-3 h-3" /> สมาชิกบุคคลธรรมดา
                    </p>
                    
                    <div className="flex flex-col gap-3">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg text-sm font-bold h-11" onClick={() => router.push(`/chat/${caseData.id}`)}>
                        <MessageSquare className="w-4 h-4 mr-2" /> แลกเปลี่ยนข้อมูลผ่านแชท
                      </Button>
                      <Button variant="outline" className="w-full h-11 border-slate-200 font-bold hover:bg-slate-50">
                        ดูประวัติการติดต่อ
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Strategic Advice Card */}
                <Card className="rounded-[2rem] border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 shadow-xl overflow-hidden group border-2">
                   <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                         <CardTitle className="text-sm font-black italic uppercase tracking-tighter flex items-center gap-2 text-blue-700">
                           <BrainCircuit className="w-5 h-5" /> AI Strategic Analysis
                         </CardTitle>
                         {!strategicAdvice && (
                            <Badge className="bg-blue-600 text-[8px] animate-pulse">PREMIUM TOOL</Badge>
                         )}
                      </div>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      {strategicAdvice ? (
                        <div className="space-y-4">
                           <div className="p-5 rounded-[1.5rem] bg-white/90 border border-blue-100 text-[13px] leading-relaxed text-slate-700 prose prose-sm max-w-none prose-blue prose-p:my-1 prose-ul:my-2 prose-li:my-0.5 max-h-[400px] overflow-auto scrollbar-hide">
                              <ReactMarkdown>{strategicAdvice}</ReactMarkdown>
                           </div>
                           <Button 
                             variant="outline" 
                             className="w-full rounded-xl h-9 text-[10px] font-bold border-blue-200 text-blue-600 hover:bg-blue-50"
                             onClick={handleGenerateAdvice}
                             disabled={isGeneratingAdvice}
                           >
                              {isGeneratingAdvice ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                              วิเคราะห์ใหม่ด้วยข้อมูลล่าสุด
                           </Button>
                        </div>
                      ) : (
                        <div className="text-center py-4 space-y-4">
                           <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-blue-200 transform group-hover:scale-110 transition-transform duration-500">
                              <Sparkles className="w-6 h-6 text-white animate-pulse" />
                           </div>
                           <div className="space-y-1">
                              <h4 className="font-bold text-slate-900 text-sm">วิเคราะห์กลยุทธ์ด้วย AI</h4>
                              <p className="text-[10px] text-slate-500 px-2 line-clamp-2">
                                ระบบจะเสนอแผนการสู้คดีและความชัดเจนในขั้นตอนถัดไป
                              </p>
                           </div>
                           <Button 
                             className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black italic uppercase tracking-tighter shadow-lg shadow-blue-200 text-xs"
                             onClick={handleGenerateAdvice}
                             disabled={isGeneratingAdvice}
                           >
                              {isGeneratingAdvice ? (
                                <><Loader2 className="w-3 h-3 animate-spin mr-2" /> กำลังประมวลผลกลยุทธ์...</>
                              ) : (
                                <><BrainCircuit className="w-4 h-4 mr-2" /> เริ่มการวิเคราะห์</>
                              )}
                           </Button>
                        </div>
                      )}
                   </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                   <CardHeader className="pb-3 text-sm font-bold uppercase tracking-tighter text-slate-500">สรุปการเงินเบื้องต้น</CardHeader>
                   <CardContent className="space-y-4">
                     <div className="flex justify-between items-end border-b border-slate-100 pb-3">
                        <span className="text-sm text-slate-500">เรียกเก็บแล้วทั้งหมด</span>
                        <span className="text-lg font-bold">฿15,000.00</span>
                     </div>
                     <div className="flex justify-between items-end text-amber-600">
                        <span className="text-sm">รอการชำระ</span>
                        <span className="text-xl font-black">฿5,000.00</span>
                     </div>
                   </CardContent>
                   <CardFooter>
                     <Button variant="link" className="w-full text-blue-600 font-bold p-0 justify-start" onClick={() => setActiveTab('billing')}>ดูรายละเอียดในแถบการเงิน →</Button>
                   </CardFooter>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-500" /> ลำดับเหตุการณ์และประวัติการทำงาน
                </CardTitle>
                <CardDescription>บันทึกทุกกิจกรรมที่เกิดขึ้นในคดีนี้ตั้งแต่วันเริ่มต้น</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                  {[
                    { title: 'ยื่นคำฟ้องต่อศาลแพ่ง (ผ่านระบบ e-Filing)', type: 'action', date: '21 มี.ค. 2567', time: '14:30', user: 'คุณ (ทนาย)', icon: <Gavel className="w-3 h-3" />, color: 'bg-blue-600' },
                    { title: 'อัปโหลดหลักฐานเพิ่มเติม: สัญญาจ้างระบุเงื่อนไข', type: 'document', date: '18 มี.ค. 2567', time: '10:15', user: 'ลูกความ', icon: <FileText className="w-3 h-3" />, color: 'bg-green-500' },
                    { title: 'จัดทำร่างคำฟ้องแล้วเสร็จ', type: 'system', date: '15 มี.ค. 2567', time: '16:45', user: 'ระบบ', icon: <CheckCircle2 className="w-3 h-3" />, color: 'bg-slate-400' },
                    { title: 'วิเคราะห์รูปคดีและแนวทางสู้คดี', type: 'action', date: '12 มี.ค. 2567', time: '09:00', user: 'คุณ (ทนาย)', icon: <Info className="w-3 h-3" />, color: 'bg-blue-400' },
                    { title: 'เริ่มต้นการว่าจ้างคดี', type: 'system', date: '10 มี.ค. 2567', time: '08:00', user: 'ระบบ', icon: <ShieldCheck className="w-3 h-3" />, color: 'bg-slate-900' },
                  ].map((event, i) => (
                    <div key={i} className="relative">
                      <div className={`absolute -left-[31px] top-1 w-6 h-6 rounded-full flex items-center justify-center z-10 text-white ${event.color} shadow-sm ring-4 ring-white`}>
                        {event.icon}
                      </div>
                      <div 
                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all cursor-pointer group hover:shadow-md"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-slate-900 text-sm">{event.title}</h4>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">{event.time}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{event.date} • โดย {event.user}</p>
                        {event.type === 'document' && (
                          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 mt-2">
                             <FileText className="w-4 h-4 text-slate-400" />
                             <span className="text-xs font-medium text-slate-600">evidence_contract_revised.pdf</span>
                             <Download className="w-3 h-3 text-blue-500 ml-auto cursor-pointer" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Folder Sidebar */}
              <div className="md:col-span-1 space-y-2">
                <Button 
                  className="w-full justify-start bg-blue-600 hover:bg-blue-700 transition-all active:scale-95 shadow-md" 
                  size="sm"
                  onClick={() => toast({ title: "อัปโหลดเอกสารคดี", description: "กำลังจำลองการเปิดหน้าต่างเลือกไฟล์จากเครื่อง..." })}
                >
                  <Plus className="w-4 h-4 mr-2" /> อัปโหลดเอกสาร
                </Button>
                <div className="pt-4 space-y-1">
                  {[
                    { name: 'รายการเอกสารทั้งหมด', icon: <FolderOpen className="w-4 h-4 mr-2" /> },
                    { name: 'คำฟ้อง/คำคู่ความ', icon: <FileText className="w-4 h-4 mr-2" /> },
                    { name: 'เอกสารศาล', icon: <FileText className="w-4 h-4 mr-2" /> },
                    { name: 'บันทึกการประชุม', icon: <FileText className="w-4 h-4 mr-2" /> },
                  ].map((cat, i) => (
                    <Button 
                      key={i}
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setActiveDocCategory(cat.name)}
                      className={`w-full justify-start transition-all ${activeDocCategory === cat.name ? 'text-blue-600 bg-blue-50 font-bold border-l-2 border-blue-600 rounded-l-none' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                      {cat.icon} {cat.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* File List */}
              <div className="md:col-span-3">
                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">รายการเอกสารทางกฎหมาย</CardTitle>
                    <CardDescription>เอกสารที่เป็นคู่สัญญา หรือคำให้การที่เกี่ยวข้องในคดี</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 min-h-[200px]">
                      {[
                        { name: 'Draft_Summons_Final.pdf', category: 'คำฟ้อง/คำคู่ความ', size: '1.2 MB', date: '21 มี.ค. 67', user: 'ระบบ' },
                        { name: 'Client_IDCard_Copy.jpg', category: 'เอกสารศาล', size: '450 KB', date: '12 มี.ค. 67', user: 'คุณ (ทนาย)' },
                        { name: 'Fee_Agreement_Signed.pdf', category: 'บันทึกการประชุม', size: '2.1 MB', date: '10 มี.ค. 67', user: 'คุณ (ทนาย)' },
                        { name: 'Counter_Claim_v2.docx', category: 'คำฟ้อง/คำคู่ความ', size: '850 KB', date: '18 มี.ค. 67', user: 'คุณ (ทนาย)' },
                      ]
                      .filter(file => activeDocCategory === 'รายการเอกสารทั้งหมด' || file.category === activeDocCategory)
                      .map((file, i) => (
                        <div 
                          key={i} 
                          className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
                          onClick={() => setViewingDoc(file)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                               <FileText className="w-6 h-6" />
                            </div>
                            <div>
                               <h5 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{file.name}</h5>
                               <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-tighter mt-0.5">
                                 <Badge variant="outline" className="text-[8px] py-0 px-1 border-slate-200 text-slate-400">{file.category}</Badge>
                                 <span>•</span>
                                 <span>{file.size}</span>
                                 <span>•</span>
                                 <span>โดย {file.user} เมื่อ {file.date}</span>
                               </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500"><Download className="w-4 h-4" /></Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="evidence">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                   <Card className="shadow-sm border-slate-200">
                     <CardHeader className="flex flex-row items-center justify-between">
                       <div>
                         <CardTitle className="text-lg">ชุดพยานหลักฐาน (Evidence List)</CardTitle>
                         <CardDescription>รวบรวมและคัดกรองหลักฐานสำหรับยื่นต่อศาล</CardDescription>
                       </div>
                       <Button 
                          size="sm" 
                          className="bg-blue-600 transition-all hover:scale-105"
                          onClick={() => setShowAddEvidence(true)}
                        >
                          <Plus className="w-3 h-3 mr-1" /> เพิ่มหลักฐาน
                        </Button>
                     </CardHeader>
                     <CardContent>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {[
                           { title: 'ภาพถ่ายความเสียหายหน้างาน', type: 'image', count: 5, date: '18 มี.ค. 67' },
                           { title: 'บันทึกการพูดคุยทาง LINE', type: 'chat', count: 12, date: '15 มี.ค. 67' },
                           { title: 'หลักฐานการโอนเงิน (สลิป)', type: 'payment', count: 3, date: '12 มี.ค. 67' },
                           { title: 'วิดีโอกล้องวงจรปิด', type: 'video', count: 1, date: '10 มี.ค. 67' },
                         ].map((ev, i) => (
                           <div 
                             key={i} 
                             className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group"
                             onClick={() => setSelectedEvidence(ev)}
                           >
                             <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-3 group-hover:bg-blue-50 group-hover:text-blue-600 text-slate-400 transition-colors">
                                <Gavel className="w-5 h-5" />
                             </div>
                             <h5 className="font-bold text-sm mb-1">{ev.title}</h5>
                             <p className="text-[10px] text-slate-400 uppercase tracking-tight">{ev.count} รายการ • อัปเดต {ev.date}</p>
                           </div>
                         ))}
                       </div>
                     </CardContent>
                   </Card>
                </div>
                
                <div className="space-y-6">
                   <Card className="shadow-sm border-slate-200 bg-blue-600 text-white">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                           <ShieldCheck className="w-5 h-5" /> การสืบพยาน
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-blue-100">ขั้นตอนถัดไปคือการจัดทำ **"บัญชีระบุพยาน"** เพื่อยื่นต่อศาลภายในกำหนด</p>
                        <div className="p-3 rounded-xl bg-blue-700/50 border border-blue-500/50">
                           <p className="text-[10px] uppercase font-bold text-blue-300 mb-1">สถานะปัจจุบัน</p>
                           <p className="text-sm font-bold">กำลังรวบรวมหลักฐานจากลูกความ</p>
                        </div>
                                                 <Button 
                            variant="secondary" 
                            className="w-full font-bold text-blue-900 border-none transition-all hover:bg-white active:scale-95"
                            onClick={() => setShowWitnessList(true)}
                         >
                            จัดทำบัญชีพยาน →
                         </Button>

                      </CardContent>
                   </Card>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="billing">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">สรุปการเงินและใบแจ้งหนี้</CardTitle>
                  <CardDescription>จัดการค่าธรรมเนียมวิชาชีพและค่าฤชาธรรมเนียมศาล</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">ประวัติรายรับ</Button>
                  <Button size="sm" className="bg-blue-600"><Plus className="w-3 h-3 mr-1" /> สร้างใบแจ้งหนี้</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm text-center">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-2">มูลค่ารวมคดี</p>
                    <p className="text-3xl font-black text-slate-900">฿35,000</p>
                  </div>
                  <div className="p-5 rounded-3xl bg-green-50 border border-green-100 shadow-sm text-center">
                    <p className="text-xs text-green-600 uppercase font-bold tracking-widest mb-2">รับชำระแล้ว</p>
                    <p className="text-3xl font-black text-green-600">฿15,000</p>
                  </div>
                  <div className="p-5 rounded-3xl bg-amber-50 border border-amber-100 shadow-sm text-center ring-2 ring-amber-100 ring-offset-2">
                    <p className="text-xs text-amber-600 uppercase font-bold tracking-widest mb-2">ยอดค้างชำระ</p>
                    <p className="text-3xl font-black text-amber-600">฿20,000</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-tighter text-slate-500">รายงานการเงิน (Invoices)</h4>
                  <div className="overflow-hidden border border-slate-100 rounded-2xl">
                     <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
                           <tr>
                              <th className="px-6 py-4">หมายเลข</th>
                              <th className="px-6 py-4">รายการ</th>
                              <th className="px-6 py-4 text-right">จำนวนเงิน</th>
                              <th className="px-6 py-4">สถานะ</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           <tr 
                             className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                             onClick={() => toast({ title: "กำลังแสดงใบแจ้งหนี้", description: "INV-2024-001" })}
                           >
                              <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">INV-2024-001</td>
                              <td className="px-6 py-4 font-bold">ค่าจ้างว่าความ (งวดแรก)</td>
                              <td className="px-6 py-4 text-right font-bold text-slate-700">฿10,000.00</td>
                              <td className="px-6 py-4"><Badge className="bg-green-100 text-green-700 hover:bg-green-100 shadow-none border-none">ชำระแล้ว</Badge></td>
                           </tr>
                           <tr 
                             className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                             onClick={() => toast({ title: "กำลังแสดงใบแจ้งหนี้", description: "INV-2024-002" })}
                           >
                              <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">INV-2024-002</td>
                              <td className="px-6 py-4 font-bold">ค่าธรรมเนียมศาล</td>
                              <td className="px-6 py-4 text-right font-bold text-slate-700">฿5,000.00</td>
                              <td className="px-6 py-4"><Badge className="bg-green-100 text-green-700 hover:bg-green-100 shadow-none border-none">ชำระแล้ว</Badge></td>
                           </tr>
                           <tr 
                             className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                             onClick={() => toast({ title: "กำลังแสดงใบแจ้งหนี้", description: "INV-2024-003" })}
                           >
                              <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">INV-2024-003</td>
                              <td className="px-6 py-4 font-bold">ค่าจ้างว่าความ (เนื้องาน 50%)</td>
                              <td className="px-6 py-4 text-right font-bold text-slate-700">฿20,000.00</td>
                              <td className="px-6 py-4"><Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">รอการชำระ</Badge></td>
                           </tr>
                        </tbody>
                     </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="research" className="m-0 h-[calc(100vh-250px)]">
            <Card className="h-full rounded-[2.5rem] border-white/40 bg-white/40 backdrop-blur-xl shadow-2xl overflow-hidden">
               <LegalResearchTool onCite={(text, source) => {
                  toast({
                    title: "คัดลอกข้อเความเพื่ออ้างอิงแล้ว",
                    description: "คุณสามารถวางในเอกสารฉบับร่างได้ทันที",
                  });
               }} />
            </Card>
          </TabsContent>

          <TabsContent value="interpreters" className="m-0 h-[calc(100vh-250px)]">
            <Card className="h-full rounded-[2.5rem] border-white/40 bg-white/40 backdrop-blur-xl shadow-2xl overflow-hidden">
               <InterpreterSearchTool />
            </Card>
          </TabsContent>
        </div>
      </Tabs>



      {/* Add Evidence Dialog (Simplified pop-up for quick upload only) */}
      <Dialog open={showAddEvidence} onOpenChange={setShowAddEvidence}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
           <div className="p-10 text-center space-y-6">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
                 <Plus className="w-8 h-8" />
              </div>
              <DialogTitle className="text-xl font-bold font-headline">อัปโหลดพยานหลักฐานใหม่</DialogTitle>
              <DialogDescription>
                 ลากไฟล์มาวางที่นี่ หรือกดปุ่มด้านล่างเพื่อเลือกไฟล์จากคอมพิวเตอร์ของคุณ
              </DialogDescription>
              <div className="h-32 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center bg-slate-50/50 hover:bg-white hover:border-blue-300 transition-all cursor-pointer group">
                 <p className="text-xs font-bold text-slate-400 group-hover:text-blue-500">Drop files here to upload</p>
              </div>
              <div className="flex gap-3 pt-4">
                 <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => setShowAddEvidence(false)}>ยกเลิก</Button>
                 <Button className="flex-1 rounded-2xl bg-blue-600" onClick={() => {
                   setShowAddEvidence(false);
                   toast({ title: "อัปโหลดสำเร็จ", description: "พยานหลักฐานของคุณถูกบันทึกลงในระบบเรียบร้อยแล้ว" });
                 }}>เลือกไฟล์</Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CaseDetailPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <CaseDetailPageContent />
    </Suspense>
  );
}

function FadeIn({ children, delay = 0, className }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
