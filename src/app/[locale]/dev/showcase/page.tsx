'use client';

import React from 'react';
import { ShowcaseCard } from '@/components/dev/showcase-card';
import { 
  ShieldCheck, 
  CreditCard, 
  FileText, 
  Mail, 
  LayoutDashboard, 
  Bell, 
  Cpu, 
  Lock,
  Zap
} from 'lucide-react';

export default function FeatureShowcasePage({ params }: { params: { locale: string } }) {
  const { locale } = params;

  const features: any[] = [
    {
      title: 'ความปลอดภัยระดับกฎหมาย',
      description: 'รัดกุมด้วยระบบ HSTS/CSP และระบบปกปิดข้อมูลส่วนบุคคล (PII Masking) อัตโนมัติ เพื่อปกป้องความลับระหว่างทนายและลูกความ',
      icon: ShieldCheck,
      status: 'secure',
      color: 'bg-blue-600',
      techStack: ['CSP', 'HSTS', 'PII Masking', 'Rate Limiting'],
    },
    {
      title: 'ระบบชำระเงิน Stripe Connect',
      description: 'ทนายลงทะเบียนรับเงิน (Onboarding) และลูกความชำระเงินได้ทันทีในแอป พร้อมระบบแยกค่าธรรมเนียมแพลตฟอร์มอัตโนมัติ',
      icon: CreditCard,
      status: 'active',
      link: `/${locale}/dashboard/billing`,
      color: 'bg-indigo-600',
      techStack: ['Stripe Connect', 'Embedded Components', 'Split Payments'],
    },
    {
      title: 'ใบกำกับภาษี PDF อัตโนมัติ',
      description: 'แปลงรายการเรียกเก็บเงินเป็นไฟล์ PDF ใบกำกับภาษี/ใบเสร็จรับเงินที่สวยงามและถูกต้องตามกฎหมาย ผ่านระบบ Cloudflare Browser Rendering',
      icon: FileText,
      status: 'active',
      color: 'bg-emerald-600',
      techStack: ['Puppeteer', 'Browser Rendering', 'Cloudflare R2'],
    },
    {
      title: 'ระบบรับแจ้งปัญหาผ่านอีเมล',
      description: 'เปลี่ยนทุกการส่งอีเมลเข้า contact@lawslane.com ให้เป็น Support Ticket ในระบบหลังบ้านทันที เพื่อการดูแลลูกความที่รวดเร็ว',
      icon: Mail,
      status: 'active',
      color: 'bg-amber-600',
      techStack: ['Email Workers', 'Postal-Mime', 'Webhooks'],
    },
    {
      title: 'ระบบจัดการคดี (Pipeline)',
      description: 'กระดาน Kanban เพื่อให้ทนายติดตามความคืบหน้าของคดี ตั้งแต่เริ่มต้นจนถึงปิดคดี พร้อมระบบจัดการ Milestone ย่อย',
      icon: LayoutDashboard,
      status: 'active',
      link: `/${locale}/lawyer-dashboard/pipeline`,
      color: 'bg-rose-600',
      techStack: ['Kanban UI', 'Milestones', 'D1 Database'],
    },
    {
      title: 'การแจ้งเตือนหลายช่องทาง',
      description: 'ระบบส่งข้อความแจ้งเตือนผ่าน LINE Notify และ Email แบบไม่หน่วงเครื่องด้วย Cloudflare Queues',
      icon: Bell,
      status: 'active',
      color: 'bg-sky-600',
      techStack: ['Cloudflare Queues', 'Resend', 'LINE Notify'],
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFF] relative overflow-hidden font-sans">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-[800px] overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-indigo-400/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        {/* Header Section */}
        <div className="max-w-3xl mb-16 animate-in fade-in slide-in-from-bottom-5 duration-700">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600/10 text-blue-600 text-xs font-black uppercase tracking-wider mb-6 border border-blue-600/20">
            <Zap className="w-3.5 h-3.5 mr-2" />
            LawsLane Platform Capabilities
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight mb-6">
            ยกระดับตลาดทนายความ <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">ด้วยเทคโนโลยีระดับโลก</span>
          </h1>
          <p className="text-xl text-slate-500 leading-relaxed">
            เรารวบรวมระบบจัดการคดี การเงิน และความปลอดภัยที่เพิ่งอัปเดตใหม่ล่าสุด 
            มาสรุปให้คุณเห็นภาพรวมความล้ำหน้าของแพลตฟอร์ม LawsLane
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
          {features.map((feature, idx) => (
            <ShowcaseCard key={idx} {...feature} />
          ))}
        </div>

        {/* Technical Footer */}
        <div className="bg-slate-900 rounded-[40px] p-8 md:p-12 text-white relative overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500">
          <div className="absolute right-0 bottom-0 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full" />
          
          <div className="grid md:grid-cols-2 gap-12 relative z-10">
            <div>
              <h2 className="text-3xl font-bold mb-4">LawsLane Tech Stack</h2>
              <p className="text-slate-400 text-lg">
                ขับเคลื่อนด้วยเทคโนโลยี Serverless และ Edge Computing เพื่อความรวดเร็วและความปลอดภัยสูงสุดของข้อมูลทนายและลูกความ
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center space-x-3">
                <Cpu className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium">Serverless Computing</span>
              </div>
              <div className="flex items-center space-x-3">
                <Lock className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium">Zero-Trust Security</span>
              </div>
              <div className="flex items-center space-x-3 text-blue-400">
                <CheckCircleIcon className="w-5 h-5" />
                <span className="text-sm font-medium text-white">Full D1 Database Sync</span>
              </div>
              <div className="flex items-center space-x-3">
                <Zap className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium">Edge Optimized</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCircleIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
