import type { Metadata } from 'next';
import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import { COMPANY } from '@/lib/constants/company';

export const metadata: Metadata = {
  title: 'Terms and Conditions — Paqad',
  description: 'Terms for use of the Paqad platform.',
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
        <h1>Terms and Conditions</h1>
        <p className="text-muted-foreground">Last updated: September 2026</p>

        <p>
          These terms govern use of Paqad. By creating an account or using the service, you agree to
          them. {COMPANY.poweredBy}.
        </p>

        <h2>Acceptance</h2>
        <p>
          If you do not agree to these terms, do not use Paqad.
        </p>

        <h2>Service</h2>
        <p>
          Paqad is cloud software for HR, recruitment, payroll workflows, leave, and team
          recognition. Features may vary by plan and region.
        </p>

        <h2>Accounts</h2>
        <p>
          Keep your credentials secure. You are responsible for activity under your account.
          Workspace owners control member access and billing.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Use Paqad only for lawful purposes. Do not attempt unauthorised access. Follow local law
          for payroll and payments.
        </p>

        <h2>Billing</h2>
        <p>
          Paid plans bill per seat unless we state otherwise. A trial becomes a paid plan unless you
          cancel before the trial ends.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          We provide Paqad as-is to the extent the law allows. We are not liable for indirect or
          consequential loss from use of the service.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms. We will post changes on this page. Continued use means you
          accept the updated terms.
        </p>

        <h2>Contact</h2>
        <p>
          {COMPANY.legalName}
          <br />
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </p>
      </main>
    </div>
  );
}
