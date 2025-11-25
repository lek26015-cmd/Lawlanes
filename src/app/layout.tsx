
import type { Metadata } from 'next';
import './globals.css';
import React from 'react';
import { ClientProviders } from './client-providers';
import { i18n } from '../../i18n.config';
import { getDictionary } from '@/lib/dictionary';
import { Locale } from '../../i18n.config';

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ lang: locale }))
}

export const metadata: Metadata = {
  title: 'Lawlanes AI Legal Advisor',
  description: 'Preliminary legal assessments for SMEs in Thailand.',
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { lang: string };
}>) {
  const dict = await getDictionary(params.lang as Locale);

  return (
    <html lang={params.lang} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ClientProviders navigation={dict}>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
