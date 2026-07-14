'use client';

import { usePageViewTracker } from '@/hooks/use-page-view-tracker';

/**
 * Invisible component that tracks page views.
 * Must be placed inside FirebaseClientProvider.
 */
export function PageViewTracker() {
  usePageViewTracker();
  return null;
}
