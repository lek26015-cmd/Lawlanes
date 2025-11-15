'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApprovedLawyers } from '@/lib/data';
import LawyerCard from '@/components/lawyer-card';
import type { LawyerProfile } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import React from 'react';

function LawyersPageContent() {
  const searchParams = useSearchParams();
  const specialties = searchParams.get('specialties');

  const [allLawyers, setAllLawyers] = useState<LawyerProfile[]>([]);
  const [filteredLawyers, setFilteredLawyers] = useState<LawyerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLawyers() {
      setIsLoading(true);
      const lawyers = await getApprovedLawyers();
      setAllLawyers(lawyers);
      setIsLoading(false);
    }
    fetchLawyers();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (specialties) {
      const specialtyArray = specialties.split(',');
      const recommended = allLawyers.filter(lawyer =>
        lawyer.specialty.some(spec => specialtyArray.includes(spec))
      );
      // Put recommended lawyers first, then the rest
      const remaining = allLawyers.filter(lawyer => 
        !recommended.some(rec => rec.id === lawyer.id)
      );
      setFilteredLawyers([...recommended, ...remaining]);
    } else {
      setFilteredLawyers(allLawyers);
    }
  }, [specialties, allLawyers, isLoading]);

  const recommendedLawyerIds = specialties ? allLawyers
    .filter(lawyer => lawyer.specialty.some(spec => specialties.split(',').includes(spec)))
    .map(l => l.id) : [];

  return (
    <div className="container mx-auto px-4 md:px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl font-headline">
          {specialties ? 'ทนายที่แนะนำสำหรับคุณ' : 'Expert Lawyer Marketplace'}
        </h1>
        <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
          {specialties
            ? 'นี่คือรายชื่อทนายที่ AI แนะนำจากปัญหาของคุณ พร้อมรายชื่อทนายทั้งหมด'
            : 'A curated list of approved lawyers specializing in civil and fraud cases for SMEs.'}
        </p>
      </div>
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredLawyers.map((lawyer) => (
             <div key={lawyer.id} className={recommendedLawyerIds.includes(lawyer.id) ? 'border-2 border-primary rounded-xl shadow-lg' : ''}>
                <LawyerCard lawyer={lawyer} />
             </div>
          ))}
        </div>
      )}
    </div>
  );
}


export default function LawyersPage() {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <LawyersPageContent />
        </React.Suspense>
    )
}
