import type { NextConfig } from "next";
// Force restart

// @ts-check
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },

  // PDF ใบเสร็จอ่านฟอนต์ไทยด้วย fs ตอนรัน — ไฟล์ที่ไม่ได้ import ตรงๆ จะไม่ถูกแพ็กขึ้น
  // serverless function ถ้าไม่บอกไว้ตรงนี้ (อ่านไม่เจอแล้ว 500 บน Vercel)
  outputFileTracingIncludes: {
    '/api/receipts/[id]/pdf': ['./src/assets/fonts/Sarabun-*.ttf'],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // R2 removed for security — all images served via Cloudflare Images (imagedelivery.net)
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'imagedelivery.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.r2.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'profile.line-scdn.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: [
    'isomorphic-dompurify',
    'firebase-admin',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    proxyClientMaxBodySize: '60mb',
  },
  async headers() {
    return [
      // Security headers for all routes
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://apis.google.com https://static.line-scdn.net https://*.line-scdn.net https://www.gstatic.com;
              style-src 'self' 'unsafe-inline';
              img-src 'self' blob: data: https://*.lawslane.com https://imagedelivery.net https://*.r2.dev https://*.googleapis.com https://*.firebaseapp.com https://firebasestorage.googleapis.com https://placehold.co https://images.unsplash.com https://picsum.photos https://i.pravatar.cc https://*.googleusercontent.com https://profile.line-scdn.net https://upload.wikimedia.org https://dbdregistered.dbd.go.th;
              font-src 'self';
              connect-src 'self' ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:* wss://* blob: https://*.lawslane.com https://*.r2.dev https://*.workers.dev https://challenges.cloudflare.com https://*.googleapis.com https://*.firebaseapp.com https://*.firebaseio.com https://api.line.me https://*.line.me https://*.line-scdn.net https://*.cloudflaretokens.com;
              frame-src 'self' https://challenges.cloudflare.com https://*.firebaseapp.com https://*.googleapis.com https://auth.lawslane.com https://access.line.me;
              base-uri 'self';
              form-action 'self';
              frame-ancestors 'none';
              object-src 'none';
            `.replace(/\s{2,}/g, ' ').trim(),
          },
          {
            // Firebase signInWithPopup โพลล์ window.closed ของ popup
            // ถ้าไม่ตั้งค่านี้ Chrome จะเตือน COOP รัวๆ ใน console
            // (ค่าเดียวกับที่ capdeal ใช้อยู่แล้ว)
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  async redirects() {
    // URL เก่าที่ไม่มี locale (เช่น /verify-lawyer ที่เคยติดอันดับ Google) → /th/... แบบถาวร (308)
    // เดิม next-intl ส่ง 307 ชั่วคราว อันดับจึงไม่ย้ายตามไป URL ใหม่ · หน้าแรก / ยังให้ next-intl เลือกภาษาเอง
    const publicPagesWithoutLocale = [
      'lawyers', 'interpreters', 'law-search', 'articles', 'forms', 'for-lawyers',
      'verify-lawyer', 'about', 'help', 'ai-disclaimer', 'privacy', 'terms',
    ].flatMap((page) => [
      // แยก 2 แบบ: `/:path*` ตอนว่างจะได้ปลายทางมี / ต่อท้าย → redirect ซ้ำอีกทอด
      { source: `/${page}`, destination: `/th/${page}`, permanent: true },
      { source: `/${page}/:path+`, destination: `/th/${page}/:path+`, permanent: true },
    ]);

    // คู่มือย้ายไปเว็บแยก docs.lawslane.com (repo lawslane-docs) — ภาษาเดียวกับที่เปิดมา
    const guideMoved = [
      { source: '/guide', destination: 'https://docs.lawslane.com/th', permanent: true },
      { source: '/:locale(th|en|zh)/guide', destination: 'https://docs.lawslane.com/:locale', permanent: true },
    ];

    // หลังยกหลังบ้านไป admin.lawslane.com แล้ว (แผนรวมหลังบ้าน Module 1)
    // ลิงก์เก่าที่คนบุ๊กมาร์กไว้ต้องไม่ 404 — permanent: false เผื่อย้ายกลับ/เปลี่ยนปลายทาง
    return [
      ...publicPagesWithoutLocale,
      ...guideMoved,
      // เลิกรับสมัครล่ามบนเว็บแล้ว — หน้ารับสมัครเดิมไปหน้าบริการล่ามแทน
      { source: '/for-interpreters/:path*', destination: '/th/interpreters', permanent: true },
      { source: '/:locale(th|en|zh)/for-interpreters/:path*', destination: '/:locale/interpreters', permanent: true },
      // ไม่แสดงรายชื่อ/โปรไฟล์ล่ามและการจองเองบนเว็บแล้ว — ลูกค้าส่งคำขอแล้วคุยกับแอดมินที่ /interpreters
      // permanent: false เผื่อกลับมาเปิดโปรไฟล์ล่ามอีก
      {
        source: '/:locale(th|en|zh)/interpreters/:id/:rest*',
        destination: '/:locale/interpreters',
        permanent: false,
      },
      {
        source: '/:locale(th|en)/admin/registry-import',
        destination: 'https://admin.lawslane.com/lawyer-registry/import',
        permanent: false,
      },
      {
        source: '/:locale(th|en)/admin/:path*',
        destination: 'https://admin.lawslane.com/:path*',
        permanent: false,
      },
      {
        // /dev/* เป็นเครื่องมือ dev ที่ ship ขึ้น production มาตลอด ลบทิ้งแล้ว
        source: '/:locale(th|en)/dev/:path*',
        destination: '/:locale',
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
