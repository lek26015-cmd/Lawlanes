'use client';

import React from 'react';
import { useCart } from '@/context/cart-context';
import { useChat } from '@/context/chat-context';
import { useTranslations, useLocale } from 'next-intl';
import { useFirebase } from '@/firebase';
import { X, Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const CartDrawer = () => {
  const { items, isOpen, setIsOpen, updateQuantity, removeFromCart, totalPrice, totalItems } = useCart();
  const { isAiChatOpen } = useChat();
  const { user } = useFirebase();
  const locale = useLocale();
  const t = useTranslations('Books.cart');

  if (!isOpen && totalItems === 0) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-[150] backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating Cart Trigger (Mini) when closed and has items */}
      {!isOpen && totalItems > 0 && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed bottom-24 right-6 bg-gold text-white w-16 h-16 rounded-full shadow-2xl z-40 hover:scale-110 transition-all duration-300 flex items-center justify-center group",
            isAiChatOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
          )}
        >
          <div className="relative">
            <ShoppingBag className="w-7 h-7" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] border-2 border-white shadow-sm">
              {totalItems}
            </span>
          </div>
        </button>
      )}

      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-[151] transition-transform duration-500 ease-in-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-gold" />
              <h2 className="text-xl font-bold text-deep-blue">{t('title')}</h2>
              <span className="text-gray-400 font-normal">({totalItems})</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                  <ShoppingBag className="w-10 h-10 text-gray-200" />
                </div>
                <p className="text-gray-500 font-medium">{t('empty')}</p>
                <Button 
                  variant="outline" 
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border-gold text-gold hover:bg-gold hover:text-white"
                >
                  {t('continueShopping')}
                </Button>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex gap-4 group">
                  <div className="relative w-20 h-28 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                    <Image
                      src={item.imageUrl || '/placeholder-book.jpg'}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-deep-blue line-clamp-2 leading-tight">
                          {item.title}
                        </h4>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{item.author}</p>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 border rounded-full p-1 border-gray-100 bg-gray-50">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white transition-colors"
                        >
                          <Minus className="w-3 h-3 text-gold" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white transition-colors"
                        >
                          <Plus className="w-3 h-3 text-gold" />
                        </button>
                      </div>
                      <span className="font-bold text-gold">฿{item.price.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="p-6 border-t bg-gray-50">
              <div className="flex justify-between items-center mb-6">
                <span className="text-gray-500 font-medium">{t('subtotal')}</span>
                <span className="text-2xl font-bold text-deep-blue">฿{totalPrice.toLocaleString()}</span>
              </div>
              <Button 
                asChild
                className="w-full h-12 rounded-full bg-gold hover:bg-gold-dark text-white font-bold text-lg shadow-lg hover:shadow-gold/20 transition-all flex items-center justify-center gap-2"
              >
                <Link href={user ? "/books/checkout" : `/login?redirect=/books/checkout`}>
                  {t('checkout')}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
