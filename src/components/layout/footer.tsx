'use client';

import Link from 'next/link';
import Logo from '@/components/logo';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  const isAuthPage = pathname === '/signup';

  const quickLinks = [
    { href: '/', label: 'หน้าแรก' },
    { href: '/#features', label: 'บริการ' },
    { href: '/articles', label: 'บทความ' },
    { href: '/lawyers', label: 'ค้นหาทนาย' },
    { href: '/dashboard', label: 'แดชบอร์ดลูกค้า' },
  ];

  const forLawyersLinks = [
    { href: '/', label: 'เข้าร่วมเป็นทนาย Lawlane' },
    { href: '/', label: 'เข้าสู่ระบบทนาย' },
    { href: '#', label: 'Dashboard ทนาย' },
  ];

  const legalLinks = [
    { href: '/privacy', label: 'นโยบายความเป็นส่วนตัว' },
    { href: '/terms', label: 'ข้อกำหนดการใช้งาน' },
    { href: '/help', label: 'ศูนย์ช่วยเหลือ' },
  ];
  
  if (isAuthPage) {
    return null; // Don't render footer on login/signup pages
  }


  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex flex-col">
            <Logo className="text-white mb-4" />
            <p className="text-sm text-gray-400 max-w-xs">
              ตลาดกลางทนายความออนไลน์ เชื่อมต่อคุณกับผู้เชี่ยวชาญกฎหมาย
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-white mb-4">ลิงก์ด่วน</h3>
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
            <h3 className="font-semibold text-white mb-4">สำหรับทนายความ</h3>
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
            <h3 className="font-semibold text-white mb-4">กฎหมาย</h3>
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
          <p>&copy; {new Date().getFullYear()} Lawlane. All rights reserved. (Demo Version)</p>
        </div>
      </div>
    </footer>
  );
}
