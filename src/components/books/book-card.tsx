'use client';

import React from 'react';
import { Book } from '@/lib/types';
import { useCart } from '@/context/cart-context';
import { useTranslations } from 'next-intl';
import { ShoppingCart, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';
import Image from 'next/image';

interface BookCardProps {
  book: Book;
}

const BookCard = ({ book }: BookCardProps) => {
  const { addToCart } = useCart();
  const t = useTranslations('Books');

  const handleBuyNow = () => {
    addToCart(book);
    // The cart drawer opens automatically on addToCart
  };

  return (
    <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-slate-100 flex flex-col h-full">
      {/* Image Area */}
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-50">
        <Image
          src={book.imageUrl || '/placeholder-book.jpg'}
          alt={book.title}
          fill
          className="object-cover transition-transform duration-1000 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1E1B4B]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end p-6">
          <div className="flex gap-2 w-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
            <Button 
              onClick={() => addToCart(book)}
              className="flex-1 bg-white hover:bg-[#FACC15] text-[#1E1B4B] hover:text-[#1E1B4B] border-none rounded-2xl h-12 font-black transition-all shadow-xl"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t('addToCart')}
            </Button>
          </div>
        </div>
        {/* Badge for Categories */}
        <div className="absolute top-4 left-4">
          <span className="bg-white/90 backdrop-blur-md text-[#31107A] text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg border border-white/20 uppercase tracking-[0.1em]">
            {book.category}
          </span>
        </div>
      </div>

      {/* Book Info */}
      <div className="p-5 flex flex-col flex-grow">
        <Link 
          href={`/books/${book.id}`}
          className="flex-grow group/title"
        >
          <div className="mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#31107A] bg-[#31107A]/5 px-3 py-1 rounded-full">
              {book.category}
            </span>
          </div>
          <h3 className="font-black text-[#1E293B] text-xl group-hover/title:text-[#31107A] transition-all duration-300 leading-tight mb-3">
            {book.title}
          </h3>
          <p className="text-sm text-slate-400 font-bold">{book.author}</p>
        </Link>

        {/* Price and Actions */}
        <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{t('price')}</span>
            <span className="text-2xl font-black text-[#FACC15] tracking-tighter">฿{book.price.toLocaleString()}</span>
          </div>
          <Button 
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addToCart(book);
            }}
            className="rounded-2xl h-12 bg-[#1E1B4B] hover:bg-[#31107A] text-white transition-all duration-300 shadow-xl hover:shadow-[#31107A]/20 group/btn"
          >
            <ShoppingCart className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
            {t('addToCart')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookCard;
