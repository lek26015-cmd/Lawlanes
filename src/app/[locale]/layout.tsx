// Deployment Trigger: Build after billing resolved
import type { Metadata } from 'next';
import { locales } from '@/navigation';
import '../globals.css';
import React from 'react';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { ClientProviders } from '../client-providers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import ScrollToTopButton from '@/components/ui/scroll-to-top';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export const metadata: Metadata = {
  metadataBase: new URL('https://www.lawslane.com'),
  title: 'Lawslane - ที่ปรึกษากฎหมายมืออาชีพเพื่อท่าน',
  description: 'แพลตฟอร์มที่เชื่อมโยงท่านกับทนายความผู้เชี่ยวชาญ ค้นหาทนายความที่ใช่ หรือปรึกษา AI ทนายความอัจฉริยะในฐานะลูกความผู้ทรงเกียรติ',
  // โลโก้สี่เหลี่ยมจัตุรัส 800×800 — Google ใช้เป็นไอคอนในผลค้นหา (ต้องเป็นสัดส่วน 1:1)
  // (ลบ src/app/icon.tsx ที่สร้างรูปตาชั่งออก: /icon โดน middleware redirect ไป /th/icon ใช้ไม่ได้)
  icons: {
    icon: '/icon.jpg',
    apple: '/icon.jpg',
  },
  openGraph: {
    title: 'Lawslane - Digital Legal Hub สำหรับลูกความทุกท่าน',
    description: 'ปรึกษาปัญหากฎหมายกับทนายความผู้เชี่ยวชาญ มั่นใจในทุกคดีด้วยห้องดำเนินการคดีระดับพรีเมียม',
    images: [
      {
        url: '/icon.jpg',
        width: 800,
        height: 800,
        alt: 'Lawslane Logo',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  verification: {
    google: '2Nf_xXUegfMiwTh1mv7N-LhpkpMAZu_cD7OGppnzD5I',
  },
};


export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Enable static rendering
  setRequestLocale(locale);

  const messages = await getMessages({ locale });
  const domainType = 'main'; // Default for SSR, will be updated on client

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Preconnect to critical third-party origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" />
        <link rel="preconnect" href="https://securetoken.googleapis.com" />
        <link rel="preconnect" href="https://firestore.googleapis.com" />
        <link rel="preconnect" href="https://www.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&display=swap" rel="stylesheet" />

        {/* JSON-LD Structured Data for Google Search Logo */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Lawslane",
              "url": "https://www.lawslane.com",
              "logo": "https://www.lawslane.com/icon.jpg",
              "description": "ที่ปรึกษากฎหมายมืออาชีพเพื่อท่าน แพลตฟอร์มที่เชื่อมโยงท่านกับทนายความผู้เชี่ยวชาญ ค้นหาทนายที่ใช่ หรือปรึกษา AI ทนายความอัจฉริยะได้ทันที เพื่อความรัดกุมและปลอดภัยสูงสุดของลูกความทุกท่าน",
              "sameAs": [
                "https://www.facebook.com/lawslane",
                "https://lin.ee/CZzSmHr",
                "https://www.tiktok.com/@lawslane"
              ]
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Lawslane",
              "url": "https://www.lawslane.com",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://www.lawslane.com/th/lawyers?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      </head>
      <body className="font-body antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ClientProviders domainType={domainType}>
            {children}
            <ScrollToTopButton />
          </ClientProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
