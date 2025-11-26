
'use client';

import Link from 'next/link';
import Logo from '@/components/logo';
import { usePathname } from 'next/navigation';
import { Locale } from '@/../i18n.config';

export default function Footer({ lang, navigation, userRole }: { lang: string, navigation: any, userRole: string | null }) {
  const pathname = usePathname();
  const isAuthPage = pathname.endsWith('/login') || pathname.endsWith('/signup') || pathname.endsWith('/lawyer-signup') || pathname.endsWith('/lawyer-login');

  let quickLinks = [
    { href: `/${lang}`, label: navigation.home },
    { href: `/${lang}/articles`, label: navigation.articles },
    { href: `/${lang}/lawyers`, label: navigation.findLawyer },
    { href: `/${lang}/verify-lawyer`, label: navigation.verifyLawyer },
  ];

  if (userRole === 'customer') {
    quickLinks.push({ href: `/${lang}/dashboard`, label: navigation.customerDashboard });
  }

  let forLawyersLinks = [
    { href: `/${lang}/for-lawyers`, label: navigation.joinLawlanes },
    { href: `/${lang}/lawyer-login`, label: navigation.lawyerLogin },
  ];
  
  if (userRole === 'lawyer') {
    forLawyersLinks.push({ href: `/${lang}/lawyer-dashboard`, label: navigation.lawyerDashboard });
  }
  
  if (userRole === 'admin') {
     forLawyersLinks.push({ href: `/admin`, label: navigation.adminDashboard });
  }


  const legalLinks = [
    { href: `/${lang}/privacy`, label: navigation.privacyPolicy },
    { href: `/${lang}/terms`, label: navigation.termsOfService },
    { href: `/${lang}/help`, label: navigation.helpCenter },
  ];
  
  if (isAuthPage) {
    return null; // Don't render footer on auth pages
  }


  return (
    <footer id="page-footer" className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex flex-col">
            <Logo className="text-white mb-4" />
            <p className="text-sm text-gray-400 max-w-xs">
              ตลาดกลางทนายความออนไลน์ เชื่อมต่อคุณกับผู้เชี่ยวชาญกฎหมาย
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-white mb-4">{navigation.quickLinks}</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-white mb-4">{navigation.forLawyers}</h3>
            <ul className="space-y-2">
              {forLawyersLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">{navigation.legal}</h3>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-6 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Lawlanes. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
