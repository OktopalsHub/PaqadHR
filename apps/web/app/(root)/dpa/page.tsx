import type { Metadata } from 'next';
import { LegalDocPage } from '@/components/legal-doc-page';

export const metadata: Metadata = {
  title: 'Data Processing Addendum — Paqad',
  description: 'Data Processing Addendum for Paqad workspace customers.',
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
