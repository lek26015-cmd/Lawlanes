
'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { th } from 'date-fns/locale';
import { MessageSquare, Briefcase, FileText, Clock, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { getCloudflareVariantUrl } from '@/lib/cloudflare-images';

interface ChatListItemProps {
  id: string;
  name: string;
  imageUrl?: string;
  lastMessage?: string;
  updatedAt: Date | string;
  unreadCount?: number;
  status: string;
  type: 'preliminary' | 'case';
  href: string;
  isLawyerView?: boolean;
  className?: string;
}

export function ChatListItem({
  id,
  name,
  imageUrl,
  lastMessage,
  updatedAt,
  unreadCount = 0,
  status,
  type,
  href,
  isLawyerView = false,
  className,
}: ChatListItemProps) {
  const date = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  
  const formatChatTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, 'HH:mm');
    }
    if (isYesterday(date)) {
      return 'เมื่อวาน';
    }
    return format(date, 'dd/MM/yy');
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'pending_payment':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] py-0 px-1.5 font-bold rounded-md">
            รอชำระเงิน
          </Badge>
        );
      case 'pending_verification': // Custom status for "รอตรวจสอบสลิป"
      case 'pending_payment_verification':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] py-0 px-1.5 font-bold rounded-md animate-pulse">
            รอตรวจสอบสลิป
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[10px] py-0 px-1.5 font-bold rounded-md">
            เสร็จสิ้น
          </Badge>
        );
      case 'active':
      default:
        return (
          <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[10px] py-0 px-1.5 font-bold rounded-md">
            ดำเนินการอยู่
          </Badge>
        );
    }
  };

  const getTypeLabel = () => {
    if (type === 'case') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
          <Briefcase className="w-3 h-3" /> แชทคดี
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
        <MessageSquare className="w-3 h-3" /> ปรึกษาเบื้องต้น
      </span>
    );
  };

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-[2rem] bg-white transition-all duration-500 border border-slate-100/50 hover:border-blue-100 hover:shadow-2xl hover:shadow-blue-200/40",
        className
      )}
    >
      <a 
        href={href}
        className="flex items-center gap-4 p-4 md:p-5 relative z-10"
      >
        {/* Avatar Container */}
        <div className="relative flex-shrink-0">
          <div className="absolute -inset-1 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
          <Avatar className="h-16 w-16 border-2 border-white shadow-md transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
            <AvatarImage src={getCloudflareVariantUrl(imageUrl, 'avatar')} />
            <AvatarFallback className="bg-slate-50 text-slate-400 font-bold text-xl">
              {name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          {/* Status indicator dot */}
          <div className={cn(
            "absolute bottom-0 right-0 h-5 w-5 rounded-full border-[3px] border-white shadow-sm transition-transform duration-500 group-hover:scale-110",
            status === 'closed' ? "bg-slate-300" : "bg-green-500"
          )} />
        </div>

        {/* Content Container */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex justify-between items-start gap-2">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-slate-900 truncate text-base md:text-lg tracking-tight group-hover:text-blue-600 transition-colors">
                  {name}
                </h3>
                {getStatusBadge()}
              </div>
              <div className="flex items-center gap-2">
                {getTypeLabel()}
              </div>
            </div>
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap pt-1">
              {formatChatTime(date)}
            </span>
          </div>

          <div className="flex justify-between items-end gap-3">
            <p className="text-sm text-slate-500 truncate leading-relaxed font-medium">
              {lastMessage || 'ยังไม่มีข้อความ'}
            </p>
            
            <div className="flex items-center gap-2 flex-shrink-0 mb-0.5">
              {unreadCount > 0 && (
                <div className="flex h-6 min-w-[24px] px-2 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white shadow-lg shadow-blue-500/40 animate-in zoom-in duration-300">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" />
              </div>
            </div>
          </div>
        </div>
      </a>
      
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-blue-50 rounded-full opacity-0 group-hover:opacity-40 transition-opacity duration-500 blur-3xl" />
    </div>
  );
}
