
'use client';

import React from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ChatProvider } from '@/context/chat-context';
import ClientLayout from '@/components/layout/client-layout';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <ChatProvider>
        <ClientLayout>{children}</ClientLayout>
      </ChatProvider>
    </FirebaseClientProvider>
  );
}
