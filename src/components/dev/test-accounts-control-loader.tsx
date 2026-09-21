'use client';

import dynamic from 'next/dynamic';

// TestAccountsControl is dev/staging tooling only (see its internal isDev
// check), but it was previously imported directly into the root layout, so
// its code (including framer-motion and firebase/auth) shipped to every
// production visitor's bundle even though it never renders for them.
// next/dynamic with ssr:false needs a client component host, hence this
// small wrapper — the root layout itself stays a server component.
const TestAccountsControl = dynamic(
  () => import('./test-accounts-control').then((mod) => mod.TestAccountsControl),
  { ssr: false }
);

export default TestAccountsControl;
