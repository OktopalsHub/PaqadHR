import type { Metadata } from 'next';
import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Privacy Policy — Paqad',
  description: 'How Paqad collects, uses, and protects your personal data under GDPR and NDPR.',
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
        <p className="text-muted-foreground">Last updated: July 2026</p>
        <p>
          PaqadHR (&quot;Paqad&quot;, &quot;we&quot;, &quot;us&quot;) provides HR and payroll
          software for teams. This policy explains how we collect, use, store, and protect personal
          data when you use our website and workspace applications. It is designed to meet the
          requirements of the EU General Data Protection Regulation (GDPR) and the Nigeria Data
          Protection Regulation (NDPR), as applicable to your location and role (account holder,
          employee, or job applicant).
        </p>

        <h2>Data controller &amp; contact</h2>
        <p>
          For account and product data, Paqad acts as the data controller for direct customers and
          as a data processor when your employer uses Paqad to manage workforce records. Workplace
          administrators may be joint controllers for employment data they enter about their teams.
        </p>
        <ul>
          <li>
            Privacy enquiries: <a href="mailto:privacy@paqad.com">privacy@paqad.com</a>
          </li>
          <li>
            Data Protection Officer (DPO): <a href="mailto:dpo@paqad.com">dpo@paqad.com</a>
          </li>
        </ul>

        <h2>Categories of data we collect</h2>
        <ul>
          <li>
            <strong>Account data:</strong> name, email, authentication credentials (stored hashed),
            country, and consent records.
          </li>
          <li>
            <strong>Employment &amp; HR data:</strong> information entered by you or your employer
            (role, department, leave, attendance, documents, emergency contacts, etc.).
          </li>
          <li>
            <strong>Payroll &amp; payment data:</strong> bank account details and payout metadata.
            Sensitive payment fields are encrypted at rest.
          </li>
          <li>
            <strong>Recruitment data:</strong> job applications, CVs, cover letters, and contact
            details submitted via public careers pages.
          </li>
          <li>
            <strong>Technical &amp; security data:</strong> IP address, device/browser metadata,
            audit logs, and anti-abuse signals (e.g. captcha verification).
          </li>
        </ul>

        <h2>Legal bases (GDPR) &amp; lawful processing (NDPR)</h2>
        <p>We process personal data on one or more of the following bases:</p>
        <ul>
          <li>
            <strong>Contract:</strong> to provide the service you or your organisation signed up
            for.
          </li>
          <li>
            <strong>Legitimate interests:</strong> to secure the platform, prevent fraud, and
            improve reliability — balanced against your rights.
          </li>
          <li>
            <strong>Legal obligation:</strong> tax, payroll, and regulatory requirements where
            applicable.
          </li>
          <li>
            <strong>Consent:</strong> where required (e.g. marketing, optional cookies, or explicit
            applicant submissions).
          </li>
        </ul>

        <h2>How we use data</h2>
        <p>
          We use personal data to operate HR, payroll, leave, recruitment, and recognition features;
          process subscriptions and payouts; send transactional notifications; investigate security
          incidents; and comply with law. We do not sell personal data.
        </p>

        <h2>Subprocessors</h2>
        <p>
          We use trusted providers to run the service. They process data only under our instructions
          and appropriate agreements:
        </p>
        <ul>
          <li>
            <strong>Cloudflare</strong> — hosting, CDN, and edge security
          </li>
          <li>
            <strong>Cloud object storage (R2/S3-compatible)</strong> — file and document storage
          </li>
          <li>
            <strong>Email delivery (ZeptoMail)</strong> — transactional email
          </li>
          <li>
            <strong>Payment &amp; payout partners</strong> — subscription billing and payroll
            disbursements where enabled for your workspace
          </li>
          <li>
            <strong>Cloudflare Turnstile</strong> — bot protection on public forms
          </li>
        </ul>
        <p>
          A current subprocessor list is available on request at{' '}
          <a href="mailto:privacy@paqad.com">privacy@paqad.com</a>.
        </p>

        <h2>International transfers</h2>
        <p>
          Your data may be processed in countries other than your own (including the EU, UK, United
          States, and Nigeria) where our infrastructure and subprocessors operate. Where required,
          we rely on appropriate safeguards such as Standard Contractual Clauses, adequacy
          decisions, or equivalent mechanisms under NDPR cross-border transfer rules.
        </p>

        <h2>Retention</h2>
        <ul>
          <li>
            <strong>Active accounts:</strong> retained while your account or workspace membership is
            active and as needed to provide the service.
          </li>
          <li>
            <strong>Deleted accounts:</strong> login credentials and direct identifiers are
            anonymised or removed; some records may be retained in backups for a limited period.
          </li>
          <li>
            <strong>Payroll &amp; tax records:</strong> retained as required by applicable law and
            your employer&apos;s policies (often 6–7 years where mandated).
          </li>
          <li>
            <strong>Recruitment applications:</strong> retained according to the hiring
            organisation&apos;s settings and legal requirements, then deleted or anonymised.
          </li>
          <li>
            <strong>Security logs:</strong> typically retained up to 90 days unless needed for an
            incident investigation.
          </li>
        </ul>

        <h2>Security</h2>
        <p>
          We use encryption in transit (TLS), encryption at rest for sensitive payment fields,
          httpOnly session cookies, role-based access controls, rate limiting on public endpoints,
          and webhook signature verification. No system is perfectly secure; report concerns to{' '}
          <a href="mailto:security@paqad.com">security@paqad.com</a>.
        </p>

        <h2>Your rights</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access and receive a copy of your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion (subject to legal and contractual limits)</li>
          <li>Restrict or object to certain processing</li>
          <li>Data portability</li>
          <li>Withdraw consent where processing is consent-based</li>
          <li>
            Lodge a complaint with a supervisory authority (e.g. NDPC in Nigeria, or your local EU
            authority)
          </li>
        </ul>
        <p>
          Account holders can <strong>export</strong> or <strong>delete</strong> their data from
          Settings → Privacy. Employees should contact their workspace administrator for employment
          records held on their behalf. Applicants may contact the hiring organisation or{' '}
          <a href="mailto:privacy@paqad.com">privacy@paqad.com</a>.
        </p>

        <h2>Children</h2>
        <p>
          Paqad is a business service not directed at children under 16. We do not knowingly collect
          data from children.
        </p>

        <h2>Changes</h2>
        <p>
          We may update this policy from time to time. Material changes will be posted on this page
          with an updated date.
        </p>

        <h2>Contact</h2>
        <p>
          Questions: <a href="mailto:privacy@paqad.com">privacy@paqad.com</a>
          <br />
          DPO: <a href="mailto:dpo@paqad.com">dpo@paqad.com</a>
        </p>
      </main>
    </div>
  );
}
