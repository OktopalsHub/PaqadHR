import type { Metadata } from 'next';
import { LegalDocPage } from '@/components/legal-doc-page';

/**
 * This page looks the same to every visitor, so it is served from the edge
 * cache and revalidated every 60 seconds instead of being rendered per request.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Terms of Use — Paqad',
  description: 'Terms governing use of the Paqad website and service.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  return (
    <LegalDocPage
      title="Terms of Use"
      description="Terms governing use of the Paqad website and service."
      file="terms.md"
    />
  );
}
