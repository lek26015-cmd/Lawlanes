
'use client';

import React from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ChatProvider } from '@/context/chat-context';
import ClientLayout from '@/components/layout/client-layout';
import { Toaster } from '@/components/ui/toaster';

export function ClientProviders({ children, navigation }: { children: React.ReactNode, navigation: any }) {
  return (
    <FirebaseClientProvider>
      <ChatProvider>
        <ClientLayout navigation={navigation}>{children}</ClientLayout>
        <Toaster />
      </ChatProvider>
    </FirebaseClientProvider>
  );
}
