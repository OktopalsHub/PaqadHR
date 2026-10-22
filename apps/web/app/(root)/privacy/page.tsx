import type { Metadata } from 'next';
import { LegalDocPage } from '@/components/legal-doc-page';

/**
 * This page looks the same to every visitor, so it is served from the edge
 * cache and revalidated every 60 seconds instead of being rendered per request.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Privacy Policy — Paqad',
  description: 'How Paqad collects, uses, and protects personal data.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <LegalDocPage
      title="Privacy Policy"
      description="How Paqad collects, uses, and protects personal data."
      file="privacy.md"
    />
  );
}
