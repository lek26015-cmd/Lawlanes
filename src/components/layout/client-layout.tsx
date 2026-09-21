'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import FloatingChatButton from '@/components/chat/floating-chat-button';
import { useUser as useAuthUser, useFirebase } from '@/firebase';

// Both only ever render after client mount (see isMounted below), so there's
// no SSR benefit to bundling them into every page's initial JS.
const ChatModal = dynamic(() => import('@/components/chat/chat-modal'), { ssr: false });
const CookieBanner = dynamic(() => import('@/components/cookie-banner'), { ssr: false });
import { doc, getDoc } from 'firebase/firestore';

export default function ClientLayout({
  children,
  domainType = 'main',
}: {
  children: React.ReactNode;
  domainType?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user } = useAuthUser();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Synchronously detect the domain type from the pathname
  const getDetectedType = (path: string, hostName?: string) => {
    if (hostName?.includes('admin.') || path.includes('/admin')) return 'admin';
    if (hostName?.includes('business.') || path.includes('/b2b')) return 'business';
    if (hostName?.includes('lawyer.') || path.includes('/lawyer-dashboard') || path.includes('/lawyer-schedule')) return 'lawyer';
    return 'main';
  };

  const initialType = getDetectedType(pathname, typeof window !== 'undefined' ? window.location.hostname : undefined);
  const [activeDomainType, setActiveDomainType] = useState<'main' | 'admin' | 'business' | 'lawyer'>(initialType);

  // Fix Radix UI hydration mismatch by waiting for client mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const currentType = getDetectedType(pathname, window.location.hostname);
    if (currentType !== activeDomainType) {
      setActiveDomainType(currentType);
    }
  }, [pathname, activeDomainType]);

  const isLawyerPage = activeDomainType === 'lawyer' || pathname.includes('/lawyer-dashboard') || pathname.includes('/lawyer-schedule');

  const isDashboardPage =
    isLawyerPage ||
    activeDomainType === 'admin' ||
    activeDomainType === 'business' ||
    pathname.includes('/admin') ||
    pathname.includes('/b2b') ||
    pathname.includes('/rag-status');

  // Early return for dashboards (Admin, Business, Lawyer) so they render full custom workspace layout
  if (isDashboardPage) {
    return <>{children}</>;
  }

  const isChatPage = pathname.includes('/chat');

  return (
    <>
      <div className="flex min-h-screen flex-col">
        {!isDashboardPage && <Header setUserRole={setUserRole} domainType={activeDomainType} />}
        <main className="flex-grow">{children}</main>
        {!isDashboardPage && !isChatPage && <Footer userRole={userRole} domainType={activeDomainType} />}
      </div>
      {isMounted && !isDashboardPage && !isChatPage && <FloatingChatButton />}
      {isMounted && !isDashboardPage && !isChatPage && <ChatModal />}

      {isMounted && <CookieBanner />}
    </>
  );
}
