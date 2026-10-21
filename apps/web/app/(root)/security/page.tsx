import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/json-ld';
import { MarketingShell } from '@/components/marketing-shell';
import { AnswerBlock, CtaRow, FaqList, PageSection, UpdatedNote } from '@/components/marketing-ui';
import { COMPANY } from '@/lib/constants/company';
import { CONTENT_UPDATED_AT, marketingPage } from '@/lib/constants/marketing-pages';
import { faqPageSchema, webPageSchema } from '@/lib/seo/site-schema';

const page = marketingPage('/security')!;

const faqs = [
  {
    question: 'Does PaqadHR have SOC 2 or ISO 27001 certification?',
    answer:
      'Not today. PaqadHR is not certified to SOC 2 or ISO 27001, and this page will say so until it is. If your procurement process requires certification, email info@paqadhr.com and ask for the current status and timeline rather than assuming one.',
  },
  {
    question: 'Where is customer data stored?',
    answer:
      'On infrastructure operated by PaqadHR and its named subprocessors. The privacy policy lists those subprocessors and the processing each one performs, and the data processing agreement sets out the terms. We do not publish the underlying hosting topology as a security control, because it is not one.',
  },
  {
    question: 'Can one customer see another customer’s employees?',
    answer:
      'No. Every workspace is a separate tenant, every query is scoped to the caller’s tenant, and a resource that belongs to another tenant is treated as missing rather than forbidden. Access inside a workspace is then limited by role.',
  },
  {
    question: 'How are user sessions protected?',
    answer:
      'Access tokens are held in httpOnly, same-site cookies rather than localStorage, so injected scripts cannot read them. State-changing requests require a CSRF token, and pages are served under a nonce-based content security policy that blocks inline script injection.',
  },
  {
    question: 'Do your logs contain employee data?',
    answer:
      'No. Logs are written without secrets, tokens, and unnecessary personal data. Audit records exist for administrative and money-moving actions so that a customer can answer who did what, without turning the audit trail into a second copy of the payroll.',
  },
];

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: { canonical: page.path },
  openGraph: {
    title: page.title,
    description: page.description,
    url: page.path,
    type: 'website',
  },
};

const controls = [
  {
    title: 'Tenant isolation',
    body: 'Every workspace is its own tenant. Reads and writes are scoped to the caller’s tenant at the query layer, and a resource lookup that does not belong to the tenant is treated as missing rather than forbidden, so the API does not leak the existence of another company’s records.',
  },
  {
    title: 'Role-based access',
    body: 'Owners, administrators, managers, and employees see different surfaces. Payroll, billing, and member management are restricted to owners and administrators; sensitive endpoints additionally enforce role guards at the controller.',
  },
  {
    title: 'Sessions in httpOnly cookies',
    body: 'Access tokens are stored in httpOnly, same-site cookies rather than localStorage, so a cross-site scripting bug cannot read them. State-changing requests require a CSRF token.',
  },
  {
    title: 'Content Security Policy',
    body: 'Every HTML response carries a nonce-based CSP with strict script sources. Inline scripts require the per-request nonce; framing is denied; object embedding is disabled.',
  },
  {
    title: 'Transport security',
    body: 'Traffic is served over TLS with HSTS (two years, includeSubDomains, preload), and the app sets clickjacking, MIME-sniffing, referrer, and permissions policies by default.',
  },
  {
    title: 'Payment and payout integrity',
    body: 'Payout webhooks require a valid provider signature. Payouts carry idempotency keys so a retry cannot pay twice, and a retry is blocked unless run-scoped funding has been verified server-to-server with the provider.',
  },
  {
    title: 'Audit logging',
    body: 'Administrative and money-moving actions are recorded with the acting member. Logs are written without secrets, tokens, or unnecessary personal data.',
  },
  {
    title: 'Rate limiting',
    body: 'Authentication, checkout, and payout endpoints are rate limited separately from ordinary reads, which blunts credential stuffing and accidental double-submits.',
  },
];

export default function SecurityPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-6 pb-20 pt-12 md:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Security</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] md:text-5xl md:leading-[1.03]">
          Security, and the limits of what we claim about it.
        </h1>
        <AnswerBlock>
          PaqadHR isolates every workspace as its own tenant, scopes every query to that tenant, and
          enforces role-based access on top. Sessions live in httpOnly cookies, HTML is served under
          a nonce-based content security policy, payout webhooks are signature-verified, and
          money-moving actions are audited. We do not hold SOC 2 or ISO 27001 certification today.
        </AnswerBlock>
        <UpdatedNote updated={CONTENT_UPDATED_AT} />

        <PageSection id="controls" title="Controls in the product">
          <div className="grid gap-4 md:grid-cols-2">
            {controls.map((control) => (
              <div key={control.title} className="rounded-[1.2rem] border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground">{control.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{control.body}</p>
              </div>
            ))}
          </div>
        </PageSection>

        <PageSection id="not-claimed" title="What we do not claim">
          <p>
            Security pages are usually a list of badges. Here is the honest version, because a
            payroll buyer should be able to tell the difference between a control that exists and a
            certificate someone bought:
          </p>
          <ul className="space-y-3">
            <li>
              <strong className="text-foreground">No SOC 2 or ISO 27001 certification.</strong> If
              your procurement process requires either, ask us for the current status and timeline
              before you plan around it.
            </li>
            <li>
              <strong className="text-foreground">
                No published uptime SLA on self-serve plans.
              </strong>{' '}
              Contractual availability terms are agreed in the order form, not implied by this page.
            </li>
            <li>
              <strong className="text-foreground">
                No claim that we are a payment institution.
              </strong>{' '}
              Payouts and collections run through regulated payment partners; PaqadHR is the system
              of record around them.
            </li>
          </ul>
        </PageSection>

        <PageSection id="data" title="Personal data">
          <p>
            We process employee data on your instructions as a processor. What we collect, why, and
            how long we keep it is set out in the{' '}
            <Link className="underline underline-offset-2" href="/privacy">
              privacy policy
            </Link>
            ; the terms that govern that processing are in the{' '}
            <Link className="underline underline-offset-2" href="/dpa">
              data processing agreement
            </Link>
            . Subprocessors are listed in the privacy policy.
          </p>
        </PageSection>

        <PageSection id="report" title="Reporting a vulnerability">
          <p>
            Email{' '}
            <a className="underline underline-offset-2" href={`mailto:${COMPANY.email}`}>
              {COMPANY.email}
            </a>{' '}
            with enough detail to reproduce the issue. Please do not test against another tenant’s
            data, run automated scanners against production, or disclose the issue publicly before
            we have had a chance to fix it.
          </p>
        </PageSection>

        <PageSection id="faq" title="Security questions">
          <FaqList items={faqs} />
        </PageSection>

        <CtaRow secondary={{ href: '/contact', label: 'Ask a security question' }} />
      </div>

      <JsonLd
        data={[
          webPageSchema({
            path: page.path,
            name: page.title,
            description: page.description,
            updated: CONTENT_UPDATED_AT,
          }),
          faqPageSchema(faqs),
        ]}
      />
    </MarketingShell>
  );
}
