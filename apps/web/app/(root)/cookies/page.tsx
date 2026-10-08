import type { Metadata } from 'next';
import { LegalDocPage } from '@/components/legal-doc-page';

export const metadata: Metadata = {
  title: 'Cookie Notice — Paqad',
  description: 'How Paqad uses cookies and similar technologies.',
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
