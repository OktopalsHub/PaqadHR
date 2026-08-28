import type { Metadata } from 'next';
import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Data Processing Agreement — Paqad',
  description:
    'How Paqad processes personal data on behalf of workspace customers under GDPR and NDPR.',
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
        <p className="text-muted-foreground">Last updated: August 2026</p>
        <p>
          This page summarises how Paqad processes personal data when your organisation uses Paqad
          as an HR and payroll platform. A signed DPA is available on request for enterprise
          customers.
        </p>

        <h2>Roles</h2>
        <ul>
          <li>
            <strong>Your organisation (workspace owner)</strong> is generally the data controller
            for employee, applicant, and workforce records you enter in Paqad.
          </li>
          <li>
            <strong>Paqad</strong> acts as a data processor, processing personal data on your
            instructions to provide hosting, security, payroll tooling, and related features.
          </li>
        </ul>

        <h2>Subject matter &amp; duration</h2>
        <p>
          Processing covers HR, payroll, recruitment, attendance, and recognition data for the term
          of your subscription and until deletion or export as described in our{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <h2>Processor obligations</h2>
        <ul>
          <li>Process personal data only on documented instructions from the controller</li>
          <li>Implement appropriate technical and organisational security measures</li>
          <li>Assist with data subject requests where applicable</li>
          <li>Notify controllers of personal data breaches without undue delay</li>
          <li>Delete or return data at end of service, subject to legal retention requirements</li>
          <li>
            Use subprocessors listed at <Link href="/subprocessors">/subprocessors</Link> under
            appropriate agreements
          </li>
        </ul>

        <h2>International transfers</h2>
        <p>
          Data may be processed in the EU, UK, United States, and Nigeria. Where required, transfers
          rely on Standard Contractual Clauses or equivalent safeguards under NDPR cross-border
          rules.
        </p>

        <h2>NDPC registration</h2>
        <p>
          Nigerian organisations may have separate obligations to register with the Nigeria Data
          Protection Commission (NDPC). Paqad does not provide legal advice; consult your counsel on
          controller-side compliance.
        </p>

        <h2>Request a signed DPA</h2>
        <p>
          For a full Data Processing Agreement or subprocessor schedule, email{' '}
          <a href="mailto:privacy@paqad.com">privacy@paqad.com</a>.
        </p>

        <p>
          See also our <Link href="/privacy">Privacy Policy</Link>,{' '}
          <Link href="/subprocessors">Subprocessors</Link> list, and{' '}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </main>
    </div>
  );
}
