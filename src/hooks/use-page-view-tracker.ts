'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { incrementPageView } from '@/lib/data';

/**
 * Hook to track page views. Call once in the root layout.
 * Increments the monthly page view counter in Firestore on each navigation.
 */
export function usePageViewTracker() {
  const pathname = usePathname();
  const { firestore } = useFirebase();
  const tracked = useRef<string>('');

  useEffect(() => {
    if (!firestore || !pathname) return;
    // Prevent double-counting the same path in strict mode
    if (tracked.current === pathname) return;
    tracked.current = pathname;

    incrementPageView(firestore);
  }, [pathname, firestore]);
}
