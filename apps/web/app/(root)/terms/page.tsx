import type { Metadata } from 'next';
import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Terms of Service — Paqad',
  description: 'Terms governing use of the Paqad HR and payroll platform.',
};

export default function TermsPage() {
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
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: June 2026</p>
        <p>
          By creating an account or using Paqad, you agree to these terms on behalf of yourself or
          the organization you represent.
        </p>
        <h2>Service</h2>
        <p>
          Paqad provides cloud software for people operations, including recruitment, payroll
          workflows, leave, and team recognition. Features may vary by plan and region.
        </p>
        <h2>Accounts</h2>
        <p>
          You are responsible for safeguarding credentials and for activity under your account.
          Workspace owners control member access and billing.
        </p>
        <h2>Acceptable use</h2>
        <p>
          You may not misuse the service, attempt unauthorized access, or use Paqad in violation of
          applicable law. Payroll and payment features must be used in compliance with local
          regulations.
        </p>
        <h2>Billing</h2>
        <p>
          Paid plans are billed per seat unless otherwise stated. Trials convert to paid
          subscriptions unless cancelled before the trial ends.
        </p>
        <h2>Limitation of liability</h2>
        <p>
          Paqad is provided as-is to the extent permitted by law. We are not liable for indirect or
          consequential damages arising from use of the service.
        </p>
        <h2>Contact</h2>
        <p>
          Questions about these terms: <a href="mailto:legal@paqad.com">legal@paqad.com</a>
        </p>
      </main>
    </div>
  );
}
