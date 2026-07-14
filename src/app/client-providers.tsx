
'use client';

import React from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ChatProvider } from '@/context/chat-context';
import { CartProvider } from '@/context/cart-context';
import ClientLayout from '@/components/layout/client-layout';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from 'next-themes';
import { PageViewTracker } from '@/components/page-view-tracker';

export function ClientProviders({ children, domainType = 'main' }: { children: React.ReactNode; domainType?: string }) {
  React.useEffect(() => {
    console.log('Lawslane Build Version: 2026-04-23 21:28 (R2 Migration)');
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={false}
      forcedTheme={domainType === 'main' ? 'light' : undefined}
    >
      <FirebaseClientProvider>
        <PageViewTracker />
        <CartProvider>
          <ChatProvider>
            <ClientLayout domainType={domainType}>{children}</ClientLayout>
            <Toaster />
          </ChatProvider>
        </CartProvider>
      </FirebaseClientProvider>
    </ThemeProvider>
  );
}
