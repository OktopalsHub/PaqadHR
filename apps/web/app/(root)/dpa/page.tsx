import type { Metadata } from 'next';
import { LegalDocPage } from '@/components/legal-doc-page';

/**
 * This page looks the same to every visitor, so it is served from the edge
 * cache and revalidated every 60 seconds instead of being rendered per request.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Data Processing Addendum — Paqad',
  description: 'Data Processing Addendum for Paqad workspace customers.',
  alternates: {
    canonical: '/dpa',
  },
};

export default function DpaPage() {
  return (
    <LegalDocPage
      title="Data Processing Addendum"
      description="Data Processing Addendum for Paqad workspace customers."
      file="dpa.md"
    />
  );
}
