import { setRequestLocale } from 'next-intl/server';
import { SignupContent } from '@/components/auth/signup-content';

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <SignupContent />;
}
