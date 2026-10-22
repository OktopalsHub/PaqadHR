import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/json-ld';
import { MarketingShell } from '@/components/marketing-shell';
import { AnswerBlock, CtaRow, FaqList, PageSection, UpdatedNote } from '@/components/marketing-ui';
import { COMPANY, companyTeam } from '@/lib/constants/company';
import { CONTENT_UPDATED_AT, marketingPage } from '@/lib/constants/marketing-pages';
import {
  faqPageSchema,
  organizationSchema,
  personSchemas,
  webPageSchema,
} from '@/lib/seo/site-schema';

/**
 * This page looks the same to every visitor, so it is served from the edge
 * cache and revalidated every 60 seconds instead of being rendered per request.
 */
export const revalidate = 60;

const page = marketingPage('/about')!;

const faqs = [
  {
    question: 'Who makes PaqadHR?',
    answer:
      'PaqadHR is built by Oktopals Limited, the company behind Paqad. The product is sold under the PaqadHR name, and the legal entity behind it is Oktopals Limited — the same company that signs your order form, data processing agreement, and support correspondence.',
  },
  {
    question: 'Is PaqadHR only for companies in Nigeria?',
    answer:
      'No. Naira payroll and Nigerian statutory deductions are the core, and the product also pays USD, EUR, GBP, USDT, and USDC, so a Nigerian company paying international contractors, or a remote team with a Nigerian entity, can run both in one workspace.',
  },
  {
    question: 'Does PaqadHR replace my accountant?',
    answer:
      'It replaces the manual work around a payroll run: collecting the data, calculating deductions, paying people, and keeping the records. The judgement and the filing obligations stay with your accountant or payroll provider — PaqadHR produces the numbers and the evidence.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Create a workspace, add your people and their pay details, and run a test payroll before it matters. The trial is 14 days and needs no card, and the team will help you through your first real run if you want a hand with it.',
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

export default function AboutPage() {
  const team = companyTeam();

  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-6 pb-20 pt-12 md:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">About</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] md:text-5xl md:leading-[1.03]">
          One workspace for the work of employing people.
        </h1>
        <AnswerBlock>
          PaqadHR is an HR and payroll platform built by {COMPANY.legalName}. It brings employee
          records, leave, attendance, recruitment, payroll, and recognition into one workspace, so a
          growing team does not run its people operations across four disconnected tools. Payroll is
          included on every plan and priced per active user.
        </AnswerBlock>
        <UpdatedNote updated={CONTENT_UPDATED_AT} />

        <PageSection id="what-we-build" title="What we build">
          <p>
            Most small and mid-sized companies do not have an HR system problem — they have a
            coordination problem. The employee list lives in a spreadsheet, leave lives in a chat
            thread, payroll lives with whoever has the bank token, and recognition lives nowhere.
            Every month someone reconciles the four by hand.
          </p>
          <p>
            PaqadHR exists to remove that reconciliation. One employee record feeds leave balances,
            payroll runs, and payslips. A payroll run pays out and keeps the provider references
            needed to prove what happened. Recognition sits next to the people it is about.
          </p>
        </PageSection>

        <PageSection id="who-its-for" title="Who it is for">
          <p>
            Teams of roughly five to five hundred people, operating in Nigeria and across borders.
            That covers a Nigerian company paying staff in naira, a remote team paying contractors
            in USD or stablecoins, and the mixed case that most growing companies actually are.
          </p>
        </PageSection>

        <PageSection id="how-its-built" title="How it is built">
          <p>
            Every workspace is a separate tenant, and access inside a workspace is role-based.
            Sessions use httpOnly cookies, administrative actions are audited, and the app runs
            behind a strict content security policy. The{' '}
            <Link className="underline underline-offset-2" href="/security">
              security page
            </Link>{' '}
            documents the controls and — just as importantly — what we do not claim.
          </p>
        </PageSection>

        {team.length > 0 ? (
          <PageSection id="team" title="Who works on PaqadHR">
            <ul className="space-y-3">
              {team.map((person) => (
                <li key={person.name} className="rounded-[1.2rem] border border-border p-5">
                  <p className="text-sm font-semibold text-foreground">{person.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{person.role}</p>
                  {person.sameAs.length > 0 ? (
                    <p className="mt-2 flex flex-wrap gap-3 text-sm">
                      {person.sameAs.map((url) => (
                        <a
                          key={url}
                          className="underline underline-offset-2"
                          href={url}
                          rel="noreferrer me"
                        >
                          Profile
                        </a>
                      ))}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </PageSection>
        ) : null}

        <PageSection id="faq" title="Common questions about the company">
          <FaqList items={faqs} />
        </PageSection>

        <PageSection id="contact" title="Talk to us">
          <p>
            For product questions, payroll coverage, or a security review, email{' '}
            <a className="underline underline-offset-2" href={`mailto:${COMPANY.email}`}>
              {COMPANY.email}
            </a>{' '}
            or use the{' '}
            <Link className="underline underline-offset-2" href="/contact">
              contact form
            </Link>
            .
          </p>
        </PageSection>

        <CtaRow secondary={{ href: '/contact', label: 'Contact the team' }} />
      </div>

      <JsonLd
        data={[
          organizationSchema(),
          ...personSchemas(),
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
