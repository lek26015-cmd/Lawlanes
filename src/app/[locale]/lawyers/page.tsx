import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { initializeFirebase } from '@/firebase';
import { getRegistryLawyers } from '@/lib/data';
import { getApprovedLawyersAction } from '@/app/actions/lawyer-directory-actions';
import type { LawyerProfile } from '@/lib/types';
import { LawyersPageClient } from './lawyers-page-client';

// The approved/registry lawyer lists are identical for every visitor regardless of
// query string (only the client-side matchmaking sort depends on that), so this is
// safe to cache and periodically revalidate rather than refetch on every request.
export const revalidate = 300;

// Fetched server-side now instead of client-side on mount (see LAWSLANE-PLAN-01 2.11) —
// this was previously a fully client-rendered page: blank HTML → JS → Firebase SDK →
// query, meaning a loading spinner and no content for search engines on first paint.
export default async function LawyersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { firestore: db } = initializeFirebase();
  // อ่านผ่าน Admin SDK + projection สาธารณะ (ดู lawyer-directory-actions.ts)
  const lawyers = (await getApprovedLawyersAction()) as unknown as LawyerProfile[];

  const approvedLicenseNumbers = new Set(
    lawyers.map(l => l.licenseNumber).filter(Boolean)
  );
  const registryLawyers = db ? await getRegistryLawyers(db, approvedLicenseNumbers, 100) : [];

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LawyersPageClient initialLawyers={lawyers} initialRegistryLawyers={registryLawyers} />
    </Suspense>
  );
}
