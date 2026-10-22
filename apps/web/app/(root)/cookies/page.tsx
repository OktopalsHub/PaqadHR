import type { Metadata } from 'next';
import { LegalDocPage } from '@/components/legal-doc-page';

/**
 * This page looks the same to every visitor, so it is served from the edge
 * cache and revalidated every 60 seconds instead of being rendered per request.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Cookie Notice — Paqad',
  description: 'How Paqad uses cookies and similar technologies.',
  alternates: {
    canonical: '/cookies',
  },
};

export default function CookiesPage() {
  return (
    <LegalDocPage
      title="Cookie Notice"
      description="How Paqad uses cookies and similar technologies."
      file="cookies.md"
    />
  );
}
