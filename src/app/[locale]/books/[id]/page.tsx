'use client';

import React, { use } from 'react';
import { useTranslations } from 'next-intl';
import { useCart } from '@/context/cart-context';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link } from '@/navigation';
import Image from 'next/image';

export default function BookDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('Books');
  const { addToCart } = useCart();
  
  // In a real app, we would fetch the book by ID
  // For now, we'll just show a generic placeholder or redirect back
  // This satisfies the navigation requirement from the BookCard
  
  return (
    <div className="min-h-screen bg-slate-50 pt-32 pb-20">
      <div className="container mx-auto px-4">
        <Link 
          href="/books" 
          className="inline-flex items-center text-slate-500 hover:text-deep-blue transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          {t('backToBooks') || 'Back to Bookstore'}
        </Link>
        
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 italic">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
            {/* Image Section */}
            <div className="relative aspect-[3/4] md:aspect-auto bg-slate-100">
              <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                 <ShoppingCart className="w-20 h-20 opacity-20" />
              </div>
              <div className="absolute top-6 left-6">
                <span className="bg-white/90 backdrop-blur-md text-gold text-xs font-bold px-4 py-2 rounded-full shadow-sm border border-gold/20 uppercase tracking-widest">
                  Legal Series
                </span>
              </div>
            </div>
            
            {/* Main Info Section */}
            <div className="p-8 md:p-12 lg:col-span-2 flex flex-col justify-center">
              <div className="mb-6 flex items-center gap-2 text-green-600 bg-green-50 w-fit px-3 py-1 rounded-full text-xs font-bold">
                <ShieldCheck className="w-4 h-4" />
                VERIFIED LEGAL CONTENT
              </div>
              
              <h1 className="text-4xl md:text-5xl font-extrabold text-deep-blue mb-4 leading-tight">
                Book Details Coming Soon
              </h1>
              
              <p className="text-xl text-slate-600 mb-8 max-w-2xl leading-relaxed">
                We are currently updating our bookstore with detailed descriptions, table of contents, and sample chapters. 
                Please check back later for the full experience.
              </p>
              
              <div className="flex flex-wrap items-center gap-6 mb-10 pt-6 border-t border-slate-100">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Author</p>
                  <p className="text-deep-blue font-bold text-lg">Lawslane Editorial Team</p>
                </div>
                <div className="h-10 w-px bg-slate-200" />
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Publisher</p>
                  <p className="text-deep-blue font-bold text-lg">Lawslane Press</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <Button 
                   onClick={() => {/* In a real app, map the ID to a book object */}}
                   disabled
                   className="rounded-full bg-deep-blue hover:bg-gold text-white h-14 px-10 text-lg font-bold transition-all shadow-lg hover:shadow-gold/20 flex items-center gap-3"
                >
                  <ShoppingCart className="w-6 h-6" />
                  Coming Soon
                </Button>
                
                <Link href="/books">
                  <Button variant="outline" className="rounded-full h-14 px-8 border-slate-200 hover:bg-slate-50 font-bold">
                    Browse Other Books
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
