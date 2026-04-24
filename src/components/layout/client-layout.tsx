'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import FloatingChatButton from '@/components/chat/floating-chat-button';
import ChatModal from '@/components/chat/chat-modal';
import CartDrawer from '@/components/books/cart-drawer';
import CookieBanner from '@/components/cookie-banner';
import { useUser as useAuthUser, useFirebase } from '@/firebase';
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
    if (hostName?.includes('lawyer.') || path.includes('/lawyer-dashboard')) return 'lawyer';
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

  const isLawyerPage = activeDomainType === 'lawyer' || pathname.includes('/lawyer-dashboard');

  const isDashboardPage =
    isLawyerPage ||
    activeDomainType === 'admin' ||
    activeDomainType === 'business' ||
    pathname.includes('/admin') ||
    pathname.includes('/b2b') ||
    pathname.includes('/rag-status');

  // Early return for non-lawyer dashboards (Admin, Business)
  if (isDashboardPage && !isLawyerPage) {
    return <>{children}</>;
  }

  const isChatPage = pathname.includes('/chat');

  return (
    <>
      <div className="flex min-h-screen flex-col">
        {(isLawyerPage || !isDashboardPage) && <Header setUserRole={setUserRole} domainType={activeDomainType} />}
        <main className="flex-grow">{children}</main>
        {(isLawyerPage || !isDashboardPage) && <Footer userRole={userRole} domainType={activeDomainType} />}
      </div>
      {isMounted && !isDashboardPage && !isChatPage && <FloatingChatButton />}
      {isMounted && !isDashboardPage && !isChatPage && <ChatModal />}
      {isMounted && !isDashboardPage && <CartDrawer />}
      {isMounted && <CookieBanner />}
    </>
  );
}
