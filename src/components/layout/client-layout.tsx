
'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import FloatingChatButton from '@/components/chat/floating-chat-button';
import ChatModal from '@/components/chat/chat-modal';
import CookieBanner from '@/components/cookie-banner';
import { Locale } from '../../../next.config';

export default function ClientLayout({
  children,
  navigation,
}: {
  children: React.ReactNode;
  navigation: any;
}) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string | null>(null);
  
  const lang = pathname.split('/')[1] as Locale;

  const isAdminPage = pathname.startsWith('/admin');
  const isAuthPage = pathname.includes('/login') || pathname.includes('/signup') || pathname.includes('/lawyer-signup');


  if (isAdminPage) {
    return <>{children}</>;
  }
  
  if (isAuthPage) {
    return <div className="flex min-h-screen flex-col"><main className="flex-1">{children}</main></div>;
  }

  return (
    <>
      <div className="flex min-h-screen flex-col">
        <Header lang={lang} navigation={navigation.header} setUserRole={setUserRole} />
        <main className="flex-1 bg-gray-50/50">{children}</main>
        <Footer lang={lang} navigation={navigation.homepage.footer} userRole={userRole} />
      </div>
      <FloatingChatButton />
      <ChatModal />
      <CookieBanner />
    </>
  );
}
