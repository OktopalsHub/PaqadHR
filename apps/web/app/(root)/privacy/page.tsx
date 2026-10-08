import type { Metadata } from 'next';
import { LegalDocPage } from '@/components/legal-doc-page';

export const metadata: Metadata = {
  title: 'Privacy Policy — Paqad',
  description: 'How Paqad collects, uses, and protects personal data.',
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
