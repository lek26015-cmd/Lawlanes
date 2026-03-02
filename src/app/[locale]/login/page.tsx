import { setRequestLocale } from 'next-intl/server';
import { LoginContent } from '@/components/auth/login-content';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LoginContent />;
}

