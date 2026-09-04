import type { Metadata } from 'next';
import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import { COMPANY } from '@/lib/constants/company';

export const metadata: Metadata = {
  title: 'Data Processing Agreement — Paqad',
  description: 'How Paqad processes personal data for workspace customers.',
};

export default function DpaPage() {
  return (
    <div className="theme-marketing min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" aria-label="Paqad home">
            <PaqadLogo />
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 prose prose-neutral">
        <h1>Data Processing Agreement (summary)</h1>
        <p className="text-muted-foreground">Last updated: September 2026</p>

        <p>
          This page summarises how we process personal data for workspace customers. Ask for a
          signed DPA if you need one.
        </p>

        <h2>Roles</h2>
        <ul>
          <li>Your organisation is usually the controller for workforce records you enter.</li>
          <li>
            {COMPANY.legalName} (Paqad) is the processor. We process data on your instructions.
          </li>
        </ul>

        <h2>Scope</h2>
        <p>
          Processing covers HR, payroll, recruitment, attendance, and recognition data for the term
          of your subscription. See the <Link href="/privacy">Privacy Policy</Link> for retention
          and deletion.
        </p>

        <h2>Our duties</h2>
        <ul>
          <li>Process data only on your documented instructions.</li>
          <li>Apply appropriate security measures.</li>
          <li>Help with data subject requests where applicable.</li>
          <li>Notify you of personal data breaches without undue delay.</li>
          <li>Delete or return data at end of service, subject to legal retention.</li>
          <li>Use subprocessors under contract (see Privacy Policy).</li>
        </ul>

        <h2>Transfers</h2>
        <p>
          Data may be processed in the EU, UK, United States, and Nigeria. We use legal safeguards
          where required.
        </p>

        <h2>Request a signed DPA</h2>
        <p>
          Email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
        </p>

        <p>
          See also our <Link href="/privacy">Privacy Policy</Link> and{' '}
          <Link href="/terms">Terms and Conditions</Link>.
        </p>
      </main>
    </div>
  );
}
