'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  Search, 
  ArrowLeft, 
  Loader2, 
  ShoppingBag,
  ExternalLink,
  MessageCircle,
  Clock
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirebase, useUser } from '@/firebase';
import { BookOrder } from '@/lib/types';
import OrderHistoryItem from '@/components/books/order-history-item';
import { cn } from '@/lib/utils';

export default function TrackingPage() {
  const t = useTranslations('Books');
  const router = useRouter();
  const { firestore, user, isUserLoading } = useFirebase();
  const [orders, setOrders] = useState<BookOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchOrders() {
      if (isUserLoading) return;
      
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Use server-side action to bypass client-side permission issues
        const { getBookOrders } = await import('@/app/actions/dashboard-actions');
        const orderData = await getBookOrders(user.uid, 50);
        setOrders(orderData as BookOrder[]);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrders();
  }, [user, isUserLoading]);

  const filteredOrders = orders.filter(order => 
    order.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.items.some(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header Splash */}
      <div className="bg-deep-blue pt-32 pb-16 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-10 right-10 w-64 h-64 bg-gold rounded-full blur-[100px]" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-gold/20 rounded-full blur-[120px]" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
              <button 
                onClick={() => router.push('/books')}
                className="flex items-center gap-2 text-gold/80 hover:text-gold transition-colors group mb-4"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="font-bold uppercase tracking-widest text-xs">Back to Store</span>
              </button>
              <h1 className="text-4xl md:text-5xl font-bold flex items-center gap-4">
                <Package className="w-10 h-10 text-gold" />
                Order Tracking
              </h1>
              <p className="text-slate-400 font-medium max-w-lg">
                ตรวจสอบสถานะการจัดส่งและประวัติการสั่งซื้อหนังสือทั้งหมดของคุณได้ที่นี่
              </p>
            </div>

            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-gold transition-colors" />
              <Input 
                placeholder="Search orders..." 
                className="w-full h-12 pl-12 bg-white/10 border-white/10 text-white placeholder:text-slate-500 rounded-2xl focus:bg-white focus:text-deep-blue focus:border-gold transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 -mt-8 relative z-20">
        {isUserLoading || isLoading ? (
          <div className="bg-white rounded-3xl p-20 shadow-xl border border-slate-100 items-center justify-center flex flex-col space-y-4">
            <Loader2 className="w-10 h-10 text-gold animate-spin" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
              {isUserLoading ? 'Verifying Session...' : 'Loading your orders...'}
            </p>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              {filteredOrders.map((order) => (
                <OrderHistoryItem key={order.id} order={order} />
              ))}
            </div>

            {/* Support / Quick Links Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="rounded-3xl border-none shadow-sm bg-white p-8">
                <h3 className="text-xl font-bold text-deep-blue mb-6 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-gold" />
                  Need Help?
                </h3>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-bold text-deep-blue text-sm">ตรวจสอบสถานะ</p>
                      <p className="text-xs text-slate-400 mt-1">ปกติเราจะอัปเดตสถานะการจัดส่งภายใน 24-48 ชั่วโมงหลังการชำระเงิน</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-bold text-deep-blue text-sm">ปัญหาการสั่งซื้อ</p>
                      <p className="text-xs text-slate-400 mt-1">ต้องการเปลี่ยนที่อยู่หรือสอบถามข้อมูลเพิ่มเติม?</p>
                      <Button variant="link" className="text-gold p-0 font-bold text-xs h-auto mt-2">ติดต่อเจ้าหน้าที่</Button>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="bg-gradient-to-br from-deep-blue to-[#0A2A5A] rounded-3xl p-8 text-white relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-700" />
                 <h4 className="text-xl font-bold mb-4 relative z-10">Premium Newsletter</h4>
                 <p className="text-slate-300 text-sm mb-6 relative z-10">รับข่าวสารกฎหมายและโปรโมชั่นหนังสือเล่มใหม่ก่อนใคร</p>
                 <Input className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 h-12 rounded-xl mb-4 relative z-10" placeholder="Email address" />
                 <Button className="w-full h-12 rounded-xl bg-gold hover:bg-gold-dark text-white font-bold border-none relative z-10">Subscribe</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-20 shadow-xl border border-slate-100 items-center justify-center flex flex-col text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8">
              <ShoppingBag className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-2xl font-bold text-deep-blue mb-2">ยังไม่มีประวัติการสั่งซื้อ</h3>
            <p className="text-slate-400 max-w-xs mx-auto mb-10">
              เริ่มสั่งซื้อหนังสือทางกฎหมายคุณภาพเพื่อพัฒนาความรู้ของคุณได้ทันที
            </p>
            <Button 
              className="h-14 px-10 rounded-2xl bg-gold hover:bg-gold-dark text-white font-bold text-lg shadow-lg shadow-gold/20 transition-all active:scale-95"
              onClick={() => router.push('/books')}
            >
              ไปเลือกชมหนังสือ
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
