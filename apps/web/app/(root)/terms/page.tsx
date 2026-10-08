import type { Metadata } from 'next';
import { LegalDocPage } from '@/components/legal-doc-page';

export const metadata: Metadata = {
  title: 'Terms of Use — Paqad',
  description: 'Terms governing use of the Paqad website and service.',
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
