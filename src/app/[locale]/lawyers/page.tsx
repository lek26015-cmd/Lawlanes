
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApprovedLawyers, getRegistryLawyers } from '@/lib/data';
import LawyerCard from '@/components/lawyer-card';
import FeaturedLawyerCard from '@/components/featured-lawyer-card';
import RegistryLawyerCard from '@/components/registry-lawyer-card';
import type { LawyerProfile, RegistryLawyer } from '@/lib/types';
import { Loader2, Award, Sparkles, ClipboardList } from 'lucide-react';
import React from 'react';
import { Progress } from '@/components/ui/progress';
import LawyerFilterSidebar from '@/components/lawyer-filter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { useFirebase } from '@/firebase';
import { LawyerPageSidebarAds } from '@/components/lawyer-page-sidebar-ads';
import { RecommendedArticles } from '@/components/recommended-articles';
import { useTranslations } from 'next-intl';

function LawyersPageContent() {
  const searchParams = useSearchParams();
  const specialties = searchParams.get('specialties');
  const matchIds = searchParams.get('matchIds');
  const { firestore } = useFirebase();
  const t = useTranslations('Lawyers');

  // Configurable list of featured lawyer names
  const FEATURED_LAWYER_NAMES = ['กฤตเมธ ไวโส'];
  const LAST_PLACE_NAMES = ['ชนาพัทธ์ ผมเพชร'];

  const [allLawyers, setAllLawyers] = useState<LawyerProfile[]>([]);
  const [filteredLawyers, setFilteredLawyers] = useState<LawyerProfile[]>([]);
  const [registryLawyers, setRegistryLawyers] = useState<RegistryLawyer[]>([]);
  const [registryDisplayCount, setRegistryDisplayCount] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isSorting, setIsSorting] = useState(false);
  const [recommendedLawyerIds, setRecommendedLawyerIds] = useState<string[]>([]);
  const [progress, setProgress] = React.useState(10);

  useEffect(() => {
    async function fetchData() {
      if (!firestore) {
        console.warn("Firestore not available in LawyersPage");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const lawyers = await getApprovedLawyers(firestore);

      // Sort: Lawyers with images first, then push LAST_PLACE to end
      lawyers.sort((a, b) => {
        const isLastA = LAST_PLACE_NAMES.some(name => a.name?.includes(name));
        const isLastB = LAST_PLACE_NAMES.some(name => b.name?.includes(name));
        if (isLastA && !isLastB) return 1;
        if (!isLastA && isLastB) return -1;

        const hasImageA = a.imageUrl && a.imageUrl.length > 0;
        const hasImageB = b.imageUrl && b.imageUrl.length > 0;
        if (hasImageA && !hasImageB) return -1;
        if (!hasImageA && hasImageB) return 1;
        return 0;
      });

      setAllLawyers(lawyers);
      setFilteredLawyers(lawyers);

      // Fetch registry lawyers (exclude those already on Lawslane)
      const approvedLicenseNumbers = new Set(
        lawyers.map(l => l.licenseNumber).filter(Boolean)
      );
      const registry = await getRegistryLawyers(firestore, approvedLicenseNumbers, 100);
      setRegistryLawyers(registry);

      setIsLoading(false);
    }
    fetchData();
  }, [firestore]);

  // Parse matchIds from URL
  const matchIdArray = useMemo(() => matchIds ? matchIds.split(',').filter(Boolean) : [], [matchIds]);
  const specialtyArray = useMemo(() => specialties ? specialties.split(',') : [], [specialties]);

  // Vector AI Matchmaking: sort by matchIds
  useEffect(() => {
    if (isLoading || !matchIds || matchIdArray.length === 0) return;

    let isMounted = true;
    setIsSorting(true);
    setProgress(30);

    const runSorting = async () => {
      await new Promise(resolve => setTimeout(resolve, 800));
      if (!isMounted) return;

      // Split lawyers into matched (in order) and the rest
      const matched: LawyerProfile[] = [];
      const rest: LawyerProfile[] = [];

      // Preserve the vector relevance order from matchIdArray
      for (const id of matchIdArray) {
        const lawyer = allLawyers.find(l => l.id === id);
        if (lawyer) matched.push(lawyer);
      }

      for (const lawyer of allLawyers) {
        if (!matchIdArray.includes(lawyer.id)) {
          rest.push(lawyer);
        }
      }

      setRecommendedLawyerIds(matched.map(l => l.id));
      setProgress(70);

      await new Promise(resolve => setTimeout(resolve, 400));
      if (!isMounted) return;

      setFilteredLawyers([...matched, ...rest]);
      setProgress(100);

      await new Promise(resolve => setTimeout(resolve, 400));
      if (!isMounted) return;
      setIsSorting(false);
    };

    runSorting();

    return () => { isMounted = false; };
  }, [matchIds, matchIdArray, allLawyers, isLoading]);

  // Legacy specialty-based sorting (backward compat)
  useEffect(() => {
    if (isLoading || !specialties || matchIds) return;

    let isMounted = true;
    setIsSorting(true);
    setProgress(30);

    const runSorting = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!isMounted) return;

      const recommended = allLawyers.filter(lawyer =>
        (lawyer.specialty || []).some(spec => specialtyArray.includes(spec))
      );
      const remaining = allLawyers.filter(lawyer =>
        !recommended.some(rec => rec.id === lawyer.id)
      );

      setRecommendedLawyerIds(recommended.map(l => l.id));
      setProgress(70);

      await new Promise(resolve => setTimeout(resolve, 500));
      if (!isMounted) return;

      setFilteredLawyers([...recommended, ...remaining]);
      setProgress(100);

      await new Promise(resolve => setTimeout(resolve, 500));
      if (!isMounted) return;
      setIsSorting(false);
    };

    runSorting();

    return () => { isMounted = false; };
  }, [specialties, allLawyers, isLoading, specialtyArray, matchIds]);

  useEffect(() => {
    if (isSorting) {
      const timer = setInterval(() => {
        setProgress(prev => (prev >= 95 ? 95 : prev + 5));
      }, 200);
      return () => clearInterval(timer);
    }
  }, [isSorting]);

  const isAiSearch = !!(matchIds || specialties);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-12">
      <div className="text-center mb-8">
        {isAiSearch ? (
          <div>
            <div className="flex justify-center mb-3">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-full">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl font-headline">
              {t('recommendedTitle')}
            </h1>
          </div>
        ) : (
          <div className="flex justify-center mb-4 flex-col">
            {/* Desktop Image */}
            <img
              src="/images/lawyers-center-lawslane.jpg"
              alt="Professional Lawyers Center"
              className="hidden md:block w-full h-auto object-cover"
            />

            {/* Mobile View: Image Only - Full Width */}
            <div className="block md:hidden w-screen -ml-4 mr-0">
              <img
                src="/images/lawyers-center-lawslane-mobile.jpg"
                alt="Professional Lawyers Center"
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        )}
        {isAiSearch && (
          <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
            {t('recommendedDescription')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 space-y-6 order-1 md:order-none">
          <LawyerFilterSidebar />
          {/* Sidebar Ads and Articles for Desktop - Hidden on Mobile */}
          <div className="hidden md:block space-y-6">
            <LawyerPageSidebarAds />
            <RecommendedArticles />
          </div>
        </div>

        <div className="md:col-span-3 order-2 md:order-none">
          {isSorting && (
            <div className="mb-8 p-4 rounded-lg bg-secondary">
              <p className="text-center font-semibold text-primary mb-2">{t('analyzing')}</p>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Show match count when AI search is active */}
              {matchIds && recommendedLawyerIds.length > 0 && !isSorting && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Award className="h-4 w-4 text-primary" />
                  <span>
                    {t('foundLawyers', { count: recommendedLawyerIds.length })} (AI Matchmaking)
                  </span>
                </div>
              )}

              <p className="text-muted-foreground mb-4">
                {t('foundLawyers', { count: filteredLawyers.length })}
              </p>

              {/* Featured Lawyers (amber border, shown first) */}
              {filteredLawyers
                .filter(l => FEATURED_LAWYER_NAMES.some(name => l.name?.includes(name)))
                .map((lawyer) => (
                  <FeaturedLawyerCard key={lawyer.id} lawyer={lawyer} />
                ))
              }

              {filteredLawyers
                .filter(l => !FEATURED_LAWYER_NAMES.some(name => l.name?.includes(name)))
                .map((lawyer) => (
                <div
                  key={lawyer.id}
                  className={`transition-all duration-500 rounded-xl ${
                    recommendedLawyerIds.includes(lawyer.id)
                      ? 'border-2 border-primary shadow-lg ring-2 ring-primary/20'
                      : ''
                  }`}
                >
                  {recommendedLawyerIds.includes(lawyer.id) && matchIds && (
                    <div className="flex items-center gap-1.5 px-4 pt-3 pb-0">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium text-primary">Best Match</span>
                    </div>
                  )}
                  <LawyerCard lawyer={lawyer} />
                </div>
              ))}

              {/* Registry Lawyers Section */}
              {registryLawyers.length > 0 && (
                <div className="mt-10">
                  {/* Section Header */}
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                      <ClipboardList className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-700">{t('registry.sectionTitle')}</h2>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 mb-4 ml-11">
                    {t('registry.sectionDescription')}
                  </p>
                  <p className="text-xs text-slate-400 mb-4 ml-11">
                    {t('registry.foundCount', { count: registryLawyers.length })}
                  </p>

                  {/* Registry Lawyer Cards */}
                  <div className="flex flex-col gap-3">
                    {registryLawyers.slice(0, registryDisplayCount).map((lawyer) => (
                      <RegistryLawyerCard key={lawyer.id} lawyer={lawyer} />
                    ))}
                  </div>

                  {/* Show More Button */}
                  {registryLawyers.length > registryDisplayCount && (
                    <div className="mt-4 text-center">
                      <Button
                        variant="outline"
                        className="rounded-xl border-slate-200 text-slate-500 hover:text-[#0B3979] hover:border-blue-200"
                        onClick={() => setRegistryDisplayCount(prev => prev + 20)}
                      >
                        {t('registry.showMore')} ({registryLawyers.length - registryDisplayCount} remaining)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Ads and Articles for Mobile - Visible only on Mobile at the bottom */}
        <div className="col-span-1 space-y-6 order-3 md:hidden">
          <LawyerPageSidebarAds />
          <RecommendedArticles />
        </div>
      </div>
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
