import type { Metadata } from 'next';
import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Subprocessors — Paqad',
  description: 'Third-party subprocessors Paqad uses to operate the HR and payroll platform.',
};

export default function SubprocessorsPage() {
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
        <h1>Subprocessors</h1>
        <p className="text-muted-foreground">Last updated: July 2026</p>
        <p>
          Paqad uses the following subprocessors to host, secure, and deliver the service. They
          process personal data only under our instructions and appropriate data protection
          agreements.
        </p>

        <ul>
          <li>
            <strong>Cloudflare</strong> — hosting, CDN, edge security, and object storage (R2)
          </li>
          <li>
            <strong>ZeptoMail</strong> — transactional email delivery
          </li>
          <li>
            <strong>Payment &amp; payout partners</strong> — subscription billing and payroll
            disbursements where enabled for your workspace (e.g. Polar, Bachs, Nomba, Monnify, Noah,
            Tremendous — depending on features enabled)
          </li>
          <li>
            <strong>Cloudflare Turnstile</strong> — bot protection on public forms
          </li>
          <li>
            <strong>Sentry</strong> — error and performance monitoring (when enabled)
          </li>
          <li>
            <strong>PostHog</strong> — privacy-oriented product analytics (EU, cookieless when
            enabled)
          </li>
        </ul>

        <p>
          We may update this list as we add or replace providers. Material changes are reflected on
          this page. For DPA enquiries or a signed subprocessor schedule, contact{' '}
          <a href="mailto:privacy@paqad.com">privacy@paqad.com</a>.
        </p>

        <p>
          See also our <Link href="/privacy">Privacy Policy</Link>,{' '}
          <Link href="/dpa">Data Processing Agreement</Link>, and{' '}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </main>
    </div>
  );
}
