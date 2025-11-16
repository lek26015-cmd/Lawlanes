
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import FloatingChatButton from '@/components/chat/floating-chat-button';
import ChatModal from '@/components/chat/chat-modal';
import CookieBanner from '@/components/cookie-banner';

function ConditionalChatComponents() {
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith('/admin');

  if (isAdminPage) {
    return null;
  }

  return (
    <>
      <FloatingChatButton />
      <ChatModal />
    </>
  );
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-gray-50/50">{children}</main>
        <Footer />
      </div>
      <ConditionalChatComponents />
      <CookieBanner />
    </>
  );
}
