'use client';

import { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase';
import { getTotalPageViews } from '@/lib/data';
import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function MonthlyVisitorBadge() {
  const { firestore } = useFirebase();
  const [views, setViews] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('Footer');

  useEffect(() => {
    async function fetchViews() {
      if (!firestore) return;
      const count = await getTotalPageViews(firestore);
      setViews(count);
      setLoading(false);
    }
    fetchViews();
  }, [firestore]);

  // Only show when total >= 500
  if (loading || views < 500) return null;

  const formattedViews = views.toLocaleString('th-TH');

  return (
    <div className="inline-flex items-center gap-2 text-gray-400">
      <Eye className="w-4 h-4" />
      <span className="text-sm">
        {t('totalVisitors', { count: formattedViews })}
      </span>
    </div>
  );
}
