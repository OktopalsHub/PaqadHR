import Link from 'next/link';
import { JsonLd } from '@/components/json-ld';
import { COMPANY } from '@/lib/constants/company';
import { CONTENT_UPDATED_AT } from '@/lib/constants/marketing-pages';
import { faqPageSchema } from '@/lib/seo/site-schema';

const faqs = [
  {
    question: 'What is PaqadHR?',
    answer:
      'PaqadHR is an HR and payroll workspace for growing teams, built by Oktopals Limited. Employee records, leave, attendance, recruitment, payroll, and recognition live in one place instead of a spreadsheet for each. It is priced per active user, and payroll is included on every plan.',
  },
  {
    question: 'How much does PaqadHR cost?',
    answer:
      'PaqadHR costs $3–$9 per active user per month, or ₦2,500–₦7,500 in naira, depending on plan. Starter covers up to 25 active users, Growth up to 100, and Scale up to 500. A payroll platform fee of 2–3% applies to payouts.',
  },
  {
    question: 'Does PaqadHR run payroll in Nigeria?',
    answer:
      'Yes. Payroll runs in naira for Nigerian employees and calculates PAYE, pension, and other statutory deductions, with payouts sent to Nigerian bank accounts through regulated payment partners. Employers remain responsible for filing and remitting to the relevant authorities.',
  },
  {
    question: 'Can I pay employees outside Nigeria?',
    answer:
      'Yes. PaqadHR pays USD (ACH, wire, RTP), EUR (SEPA), and GBP (Faster Payments) bank payouts, and USDT or USDC to supported wallets, so a team can be paid in the currency its people actually use.',
  },
  {
    question: 'Does PaqadHR integrate with Slack?',
    answer:
      'Yes, on the Growth plan and above. Shoutouts can be posted from Slack so recognition appears where the work happened, and it is recorded against the same employee record as leave and payroll.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'Yes — 14 days, with no card required. Most teams set the workspace up in an afternoon: add the people, set their pay, and run a test payroll before it matters.',
  },
  {
    question: 'Where is our data stored, and who can see it?',
    answer:
      'Each company is a separate tenant and every query is scoped to that tenant. Inside a workspace, access is role-based, so administrators, managers, and employees see different things, and administrative actions are audited. The security page documents the controls and what is not certified.',
  },
];

/**
 * The homepage is the most-cited URL a brand has, so it needs answers a model can
 * lift: a short self-contained lead, then question-and-answer pairs that also ship
 * as FAQPage structured data.
 */
export function LandingFaq() {
  return (
    <section id="faq" className="landing-deferred-paint bg-background py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Questions</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em] md:text-4xl md:leading-[1.05]">
          What teams ask before they switch.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
          PaqadHR is an HR and payroll workspace for growing teams: employee records, leave,
          attendance, recruitment, payroll, and recognition in one place, priced per active user.
          Payroll is included on every plan.
        </p>

        <div className="mt-10 divide-y divide-border border-y border-border">
          {faqs.map((faq) => (
            <div key={faq.question} className="py-6">
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                {faq.question}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Want the full detail?{' '}
          <Link className="underline underline-offset-2" href="/pricing">
            Pricing
          </Link>
          ,{' '}
          <Link className="underline underline-offset-2" href="/payroll">
            payroll coverage
          </Link>
          ,{' '}
          <Link className="underline underline-offset-2" href="/security">
            security
          </Link>
          , or{' '}
          <a className="underline underline-offset-2" href={`mailto:${COMPANY.email}`}>
            email the team
          </a>
          .
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Last reviewed{' '}
          <time dateTime={CONTENT_UPDATED_AT}>
            {new Date(`${CONTENT_UPDATED_AT}T00:00:00Z`).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </time>
        </p>
      </div>

      <JsonLd data={faqPageSchema(faqs)} />
    </section>
  );
}
