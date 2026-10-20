import type { ReactNode } from 'react';
import { AppProviders } from '@/providers/app-providers';

/** Legacy `/app/*` redirector, which needs session and tenant state. */
export default function LegacyAppLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
