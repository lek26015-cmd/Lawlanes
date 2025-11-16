import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import React from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ChatProvider } from '@/context/chat-context';
import ChatModal from '@/components/chat/chat-modal';
import FloatingChatButton from '@/components/chat/floating-chat-button';
import CookieBanner from '@/components/cookie-banner';

export const metadata: Metadata = {
  title: 'Lawlanes AI Legal Advisor',
  description: 'Preliminary legal assessments for SMEs in Thailand.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <ChatProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1 bg-gray-50/50">{children}</main>
              <Footer />
            </div>
            <FloatingChatButton />
            <ChatModal />
            <CookieBanner />
          </ChatProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
