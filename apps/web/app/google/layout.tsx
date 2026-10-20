import type { ReactNode } from 'react';
import { AppProviders } from '@/providers/app-providers';

/** OAuth completion writes the session and needs the query/session providers. */
export default function GoogleLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
