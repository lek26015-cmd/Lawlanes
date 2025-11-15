'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApprovedLawyers } from '@/lib/data';
import LawyerCard from '@/components/lawyer-card';
import type { LawyerProfile } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import React from 'react';
import { Progress } from '@/components/ui/progress';

function LawyersPageContent() {
  const searchParams = useSearchParams();
  const specialties = searchParams.get('specialties');

  const [allLawyers, setAllLawyers] = useState<LawyerProfile[]>([]);
  const [filteredLawyers, setFilteredLawyers] = useState<LawyerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSorting, setIsSorting] = useState(false);
  const [recommendedLawyerIds, setRecommendedLawyerIds] = useState<string[]>([]);
  const [progress, setProgress] = React.useState(10);

  useEffect(() => {
    async function fetchLawyers() {
      setIsLoading(true);
      const lawyers = await getApprovedLawyers();
      setAllLawyers(lawyers);
      setFilteredLawyers(lawyers); // Show all lawyers initially
      setIsLoading(false);
    }
    fetchLawyers();
  }, []);

  useEffect(() => {
    if (isLoading || !specialties) return;

    setIsSorting(true);
    setProgress(30);

    const timer = setTimeout(() => {
      const specialtyArray = specialties.split(',');
      const recommended = allLawyers.filter(lawyer =>
        lawyer.specialty.some(spec => specialtyArray.includes(spec))
      );
      const remaining = allLawyers.filter(lawyer => 
        !recommended.some(rec => rec.id === lawyer.id)
      );
      
      setRecommendedLawyerIds(recommended.map(l => l.id));
      setProgress(70);

      setTimeout(() => {
        setFilteredLawyers([...recommended, ...remaining]);
        setProgress(100);
        setTimeout(() => setIsSorting(false), 500);
      }, 500);
    }, 1000); // Simulate AI analysis and sorting time

    return () => clearTimeout(timer);

  }, [specialties, allLawyers, isLoading]);

  useEffect(() => {
    if (isSorting) {
      const timer = setInterval(() => {
        setProgress(prev => (prev >= 95 ? 95 : prev + 5));
      }, 200);
      return () => clearInterval(timer);
    }
  }, [isSorting]);


  return (
    <div className="container mx-auto px-4 md:px-6 py-12">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl font-headline">
          {specialties ? 'ทนายที่แนะนำสำหรับคุณ' : 'Expert Lawyer Marketplace'}
        </h1>
        <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
          {specialties
            ? 'นี่คือรายชื่อทนายที่ AI แนะนำจากปัญหาของคุณ พร้อมรายชื่อทนายทั้งหมด'
            : 'A curated list of approved lawyers specializing in civil and fraud cases for SMEs.'}
        </p>
      </div>

      {isSorting && (
        <div className="mb-8 p-4 rounded-lg bg-secondary/50">
            <p className="text-center font-semibold text-primary mb-2">กำลังวิเคราะห์และจัดเรียงทนายที่แนะนำ...</p>
            <Progress value={progress} className="w-full" />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredLawyers.map((lawyer) => (
             <div key={lawyer.id} className={`transition-all duration-500 ${recommendedLawyerIds.includes(lawyer.id) ? 'border-2 border-primary rounded-xl shadow-lg' : ''}`}>
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
