import type { Metadata } from 'next';
import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import { COMPANY } from '@/lib/constants/company';

export const metadata: Metadata = {
  title: 'Privacy Policy — Paqad',
  description: 'How Paqad collects and protects personal data.',
};

export default function PrivacyPage() {
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
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: September 2026</p>

        <p>
          This policy explains how {COMPANY.legalName} (&quot;we&quot;) processes personal data when
          you use Paqad. {COMPANY.poweredBy}.
        </p>

        <h2>Who we are</h2>
        <p>
          We operate Paqad / PaqadHR. We are the controller for account data. Your employer is
          usually the controller for workforce records they enter. Contact:{' '}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
        </p>

        <h2>Data we collect</h2>
        <ul>
          <li>Account data: name, email, credentials, country.</li>
          <li>HR data: role, leave, attendance, documents, emergency contacts.</li>
          <li>Payroll data: bank details and payout metadata (encrypted at rest).</li>
          <li>Recruitment data: applications and CVs from careers pages.</li>
          <li>Technical data: IP address, device data, audit logs.</li>
        </ul>

        <h2>Why we process data</h2>
        <ul>
          <li>To provide the service (contract).</li>
          <li>To keep the platform secure (legitimate interests).</li>
          <li>To meet legal and tax duties.</li>
          <li>Where you give consent for optional processing.</li>
        </ul>

        <h2>Cookies</h2>
        <p>We use essential cookies for sign-in and security. We do not use advertising cookies.</p>

        <h2>Sharing</h2>
        <p>
          We use processors under contract for hosting, email, payments, and security. We do not
          sell personal data. See our <Link href="/dpa">DPA summary</Link>.
        </p>

        <h2>Transfers</h2>
        <p>
          We may process data in the EU, UK, United States, and Nigeria. We use legal safeguards
          where required.
        </p>

        <h2>Retention</h2>
        <p>
          We keep data while your account is active. We remove or anonymise data when it is no
          longer needed, subject to legal retention (for example payroll records).
        </p>

        <h2>Security</h2>
        <p>
          We use TLS, encryption for sensitive payment fields, httpOnly cookies, access controls,
          and rate limits. Report issues to <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
        </p>

        <h2>Your rights</h2>
        <p>
          You may access, correct, delete, restrict, or object to processing of your personal data
          where the law allows. You may lodge a complaint with a supervisory authority (for example
          NDPC in Nigeria). Email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or use
          Settings → Profile.
        </p>

        <h2>Children</h2>
        <p>Paqad is not for persons under 16.</p>

        <h2>Changes</h2>
        <p>We will post material changes on this page with a new date.</p>

        <h2>Contact</h2>
        <p>
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </p>
      </main>
    </div>
  );
}
