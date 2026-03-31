'use client';

import React from 'react';
import { Package, Truck, CheckCircle, Clock, ChevronRight, MapPin, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOrder } from '@/lib/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import { th, enUS, zhCN } from 'date-fns/locale';

interface OrderHistoryItemProps {
  order: BookOrder;
}

const DATE_LOCALE_MAP: Record<string, any> = {
  th: th,
  en: enUS,
  zh: zhCN
};

export default function OrderHistoryItem({ order }: OrderHistoryItemProps) {
  const t = useTranslations('Books');
  const locale = useLocale();
  const dateLocale = DATE_LOCALE_MAP[locale] || enUS;

  const STATUS_CONFIG = {
    pending: {
      label: t('tracking.statuses.pending'),
      icon: Clock,
      color: 'bg-amber-100 text-amber-700 border-amber-200',
      step: 1
    },
    paid: {
      label: t('tracking.statuses.paid'),
      icon: CheckCircle,
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      step: 2
    },
    shipped: {
      label: t('tracking.statuses.shipped'),
      icon: Truck,
      color: 'bg-purple-100 text-purple-700 border-purple-200',
      step: 3
    },
    delivered: {
      label: t('tracking.statuses.delivered'),
      icon: Package,
      color: 'bg-green-100 text-green-700 border-green-200',
      step: 4
    },
    cancelled: {
      label: t('tracking.statuses.cancelled'),
      icon: CheckCircle,
      color: 'bg-slate-100 text-slate-500 border-slate-200',
      step: 0
    }
  };

  const currentStatus = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const StatusIcon = currentStatus.icon;

  const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();

  return (
    <Card className="rounded-3xl border-none shadow-sm hover:shadow-md transition-all overflow-hidden bg-white mb-6 group">
      <CardContent className="p-0">
        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
          {/* Order Details */}
          <div className="flex-1 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">{t('tracking.orderId')}</p>
                <h3 className="text-lg font-bold text-deep-blue flex items-center gap-2">
                  #{order.id?.substring(0, 8).toUpperCase() || 'P-82931'}
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase", currentStatus.color)}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {currentStatus.label}
                  </Badge>
                </h3>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">{t('tracking.date')}</p>
                <p className="text-sm font-bold text-slate-600">{format(orderDate, 'd MMM yyyy', { locale: dateLocale })}</p>
              </div>
            </div>

            {/* List Items */}
            <div className="space-y-4">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 group/item">
                  <div className="w-12 h-16 bg-slate-50 rounded-lg overflow-hidden flex-shrink-0 relative border border-slate-100 group-hover/item:scale-105 transition-transform">
                    <Image 
                      src={item.imageUrl} 
                      alt={item.title} 
                      fill 
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-deep-blue text-sm line-clamp-1 group-hover/item:text-gold transition-colors">{item.title}</h4>
                    <p className="text-slate-400 text-xs mt-0.5">{t('tracking.quantity', { count: item.quantity })} • ฿{item.price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">{order.shippingAddress.province || 'Bangkok'}</span>
              </div>
              <div className="h-4 w-px bg-slate-100" />
              <div className="text-deep-blue font-bold">
                 {t('tracking.total')} <span className="text-gold">฿{order.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Large Status Preview / Tracking */}
          <div className="w-full md:w-64 bg-slate-50/50 rounded-2xl p-6 flex flex-col justify-between border border-slate-100/50">
            <div className="space-y-4">
               <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t('tracking.shippingProgress')}</p>
                  <div className="flex items-center gap-2 w-full">
                    {[1, 2, 3, 4].map((s) => (
                      <div 
                        key={s} 
                        className={cn(
                          "h-1.5 flex-1 rounded-full",
                          s <= currentStatus.step ? "bg-gold" : "bg-slate-200"
                        )} 
                      />
                    ))}
                  </div>
               </div>

               {order.trackingNumber ? (
                 <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t('tracking.trackingId')}</p>
                   <p className="text-sm font-bold text-deep-blue flex items-center justify-between">
                     {order.trackingNumber}
                     <ExternalLink className="w-3 h-3 text-slate-300" />
                   </p>
                 </div>
               ) : (
                 <p className="text-xs text-slate-400 italic">{t('tracking.trackingPlaceholder')}</p>
               )}
            </div>

            <Button variant="outline" className="w-full mt-6 rounded-xl border-slate-200 text-slate-500 font-bold text-xs hover:bg-white hover:text-deep-blue hover:border-deep-blue transition-all group">
              {t('tracking.orderDetails')}
              <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
