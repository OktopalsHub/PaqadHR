import type { ReactNode } from 'react';
import { AppProviders } from '@/providers/app-providers';

/** Public tenant careers board — needs query state, toasts, and the auth context the shared nav reads. */
export default function CareersLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
