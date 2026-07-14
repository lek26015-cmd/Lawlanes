
'use client';

import type { LawyerProfile } from '@/lib/types';
import LawyerCard from '@/components/lawyer-card';

interface FeaturedLawyerCardProps {
  lawyer: LawyerProfile;
}

export default function FeaturedLawyerCard({ lawyer }: FeaturedLawyerCardProps) {
  return (
    <div className="[&>div]:border-l-amber-400 [&>div]:bg-amber-50/30 [&>div]:border-amber-200">
      <LawyerCard lawyer={lawyer} featured />
    </div>
  );
}
