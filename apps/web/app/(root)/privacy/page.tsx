import type { Metadata } from 'next';
import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Privacy Policy — Paqad',
  description: 'How Paqad collects, uses, and protects your personal data.',
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
        <p className="text-muted-foreground">Last updated: June 2026</p>
        <p>
          Paqad (&quot;we&quot;, &quot;us&quot;) provides HR and payroll software for teams. This
          policy describes how we handle personal data when you use our website and workspace
          applications.
        </p>
        <h2>Data we collect</h2>
        <ul>
          <li>Account information such as name, email, and workspace membership</li>
          <li>Employment and payroll data you or your employer enters into the product</li>
          <li>Payment method metadata for payroll (sensitive fields are encrypted)</li>
          <li>Usage logs and security events to operate and protect the service</li>
        </ul>
        <h2>How we use data</h2>
        <p>
          We use your data to provide HR, payroll, leave, and recognition features; to process
          subscriptions; to comply with legal obligations; and to improve reliability and security.
        </p>
        <h2>Sharing</h2>
        <p>
          We share data with subprocessors that help us run the service (e.g. hosting, payments,
          payroll partners such as Nomba where enabled). We do not sell personal data.
        </p>
        <h2>Your rights</h2>
        <p>
          Depending on your location, you may request access, correction, export, or deletion of
          your account. Use in-app settings or contact your workspace administrator.
        </p>
        <h2>Contact</h2>
        <p>
          Questions about this policy: <a href="mailto:privacy@paqad.com">privacy@paqad.com</a>
        </p>
      </main>
    </div>
  );
}
