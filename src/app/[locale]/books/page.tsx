'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Filter, BookIcon, Star, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Book } from '@/lib/types';
import BookCard from '@/components/books/book-card';
import { cn } from '@/lib/utils';
import { Link } from '@/navigation';

import { getBooksAction, seedBooksAction } from '@/app/actions/book-actions';

export default function BooksPage() {
  const t = useTranslations('Books');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch books on mount
  useEffect(() => {
    async function fetchBooks() {
      setIsLoading(true);
      try {
        const data = await getBooksAction();
        if (data.length === 0) {
           // Optional: Auto-seed if empty for demo
           await seedBooksAction();
           const seeded = await getBooksAction();
           setBooks(seeded);
        } else {
           setBooks(data);
        }
      } catch (error) {
        console.error("Error fetching books:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBooks();
  }, []);

  const categories = [
    { id: 'all', label: t('categories.all') },
    { id: 'business', label: t('categories.business') },
    { id: 'sme', label: t('categories.sme') },
    { id: 'contract', label: t('categories.contract') },
    { id: 'litigation', label: t('categories.litigation') },
  ];

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          book.author.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, books]);

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-[#31107A] via-[#2D126B] to-[#1E1B4B] overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-yellow-400/5 -skew-x-12 transform translate-x-1/4" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#31107A] rounded-full blur-[100px] opacity-20" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 text-[#FACC15] font-black mb-6 animate-fade-in">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md border border-white/10">
                <BookIcon className="w-5 h-5" />
              </div>
              <span className="uppercase tracking-[0.3em] text-[10px]">Lawslane Bookstore</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              {t('title')}
            </h1>
            <p className="text-xl text-slate-300 mb-10 leading-relaxed">
              {t('subtitle')}
            </p>
            
            <div className="relative max-w-2xl group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-gold transition-colors w-5 h-5" />
              <Input
                type="text"
                placeholder={t('searchPlaceholder')}
                className="w-full h-16 pl-14 pr-4 rounded-[2rem] bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:bg-white focus:text-[#1E1B4B] focus:border-[#FACC15] transition-all shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Sidebar / Filters */}
          <div className="w-full md:w-64 flex-shrink-0 space-y-8 sticky top-24">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                {t('categoriesTitle')}
              </h3>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "w-full text-left px-5 py-4 rounded-2xl transition-all flex items-center justify-between group",
                      selectedCategory === cat.id 
                        ? "bg-gradient-to-r from-[#31107A] to-[#1E1B4B] text-white font-black shadow-[0_10px_25px_rgba(49,16,122,0.3)]" 
                        : "hover:bg-white hover:shadow-lg text-slate-500 font-bold"
                    )}
                  >
                    {cat.label}
                    <ArrowRight className={cn(
                      "w-4 h-4 opacity-0 transition-all",
                      selectedCategory === cat.id ? "opacity-100" : "group-hover:opacity-50 group-hover:translate-x-1"
                    )} />
                  </button>
                ))}
              </div>
            </div>

            {/* Newsletter or Promo */}
            <div className="bg-[#171A37] rounded-[2.5rem] p-8 text-white overflow-hidden relative border border-white/5 shadow-2xl">
              <div className="absolute top-8 left-8 w-12 h-12 bg-[#FACC15]/20 rounded-full blur-xl" />
              <div className="relative z-10 flex flex-col items-start gap-6">
                <Star className="w-12 h-12 text-[#FACC15] fill-[#FACC15]" />
                
                <div className="space-y-3">
                  <h4 className="font-black text-2xl leading-tight">{t('promo.title')}</h4>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">{t('promo.description')}</p>
                </div>
                
                <Button 
                  asChild
                  className="w-full h-14 bg-[#FACC15] hover:bg-[#FACC15]/90 text-[#1E1B4B] rounded-full font-black text-lg border-none shadow-lg transition-all"
                >
                  <Link href="/login">
                    {t('promo.button')}
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Book Grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-deep-blue">
                {selectedCategory === 'all' ? t('allBooks') : categories.find(c => c.id === selectedCategory)?.label}
                <span className="ml-3 text-slate-400 font-normal text-base">({filteredBooks.length})</span>
              </h2>
            </div>

            {filteredBooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredBooks.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-20 text-center shadow-sm border border-slate-100 items-center justify-center flex flex-col">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                   <BookIcon className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="text-xl font-bold text-deep-blue mb-2">{t('noResults.title')}</h3>
                <p className="text-slate-500 max-w-xs mx-auto">{t('noResults.description')}</p>
                <Button 
                  variant="outline" 
                  className="mt-8 rounded-full border-gold text-gold hover:bg-gold hover:text-white px-8"
                  onClick={() => {setSearchQuery(''); setSelectedCategory('all');}}
                >
                  {t('noResults.button')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
