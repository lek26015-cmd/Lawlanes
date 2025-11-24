
'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import FloatingChatButton from '@/components/chat/floating-chat-button';
import ChatModal from '@/components/chat/chat-modal';
import CookieBanner from '@/components/cookie-banner';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);


  useEffect(() => {
    setIsClient(true);
  }, []);

  const isAdminPage = pathname.startsWith('/admin');
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/lawyer-signup' || pathname === '/lawyer-login';

  if (!isClient) {
    // On the server and during initial client render, render a neutral layout
    return <div className="flex min-h-screen flex-col"><main className="flex-1">{children}</main></div>;
  }

  if (isAdminPage) {
    return <>{children}</>;
  }
  
  if (isAuthPage) {
    return <div className="flex min-h-screen flex-col"><main className="flex-1">{children}</main></div>;
  }

  return (
    <>
      <div className="flex min-h-screen flex-col">
        <Header setUserRole={setUserRole} />
        <main className="flex-1 bg-gray-50/50">{children}</main>
        <Footer userRole={userRole} />
      </div>
      <FloatingChatButton />
      <ChatModal />
      <CookieBanner />
    </>
  );
}
