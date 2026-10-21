import type { Metadata } from 'next';
import { JsonLd } from '@/components/json-ld';
import { MarketingShell } from '@/components/marketing-shell';
import { AnswerBlock, CtaRow, FaqList, PageSection, UpdatedNote } from '@/components/marketing-ui';
import { CONTENT_UPDATED_AT, marketingPage } from '@/lib/constants/marketing-pages';
import { faqPageSchema, webPageSchema } from '@/lib/seo/site-schema';

const page = marketingPage('/payroll')!;

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

const faqs = [
  {
    question: 'Does PaqadHR pay employees directly?',
    answer:
      'Yes. Payroll runs from the workspace: the company funds the run, then PaqadHR sends naira bank payouts through regulated payment partners and international bank or stablecoin payouts for contractors. Every payout carries an idempotency key so a retry cannot pay twice.',
  },
  {
    question: 'Can I run payroll in more than one currency?',
    answer:
      'Yes. A run is calculated in the workspace currency, and employees can be paid in NGN, USD, EUR, or GBP depending on their destination. USDT and USDC payouts are supported on several networks for contractors who prefer stablecoins.',
  },
  {
    question: 'Does PaqadHR remit PAYE to the state government?',
    answer:
      'No. PaqadHR calculates PAYE and keeps the payroll records you need for filing, but remitting to the employee’s state internal revenue service remains the employer’s obligation. The same applies to pension, NHF, ITF, NSITF, and health insurance contributions.',
  },
  {
    question: 'Do employees receive payslips?',
    answer:
      'Yes. Publishing a run produces a payslip for each employee, and an administrator can email payslips on publish if the workspace has that setting turned on. Employees can also open their own payslips from their account.',
  },
  {
    question: 'What does payroll cost?',
    answer:
      'Payroll is included in every subscription, with a platform fee on payouts of 3% on Starter, 2.5% on Growth, and 2% on Scale. Subscription pricing is per active user per month, listed in both USD and NGN.',
  },
  {
    question: 'What happens if one employee’s payout fails?',
    answer:
      'The run records which payouts succeeded and which failed. You can retry only the failed payouts, and a Bachs-funded retry requires run-scoped funding — verified server-to-server against the provider — before it can be submitted, so a failed payout cannot be paid twice.',
  },
];

const steps = [
  {
    title: 'Add people and their pay',
    body: 'Import or add employees, set gross pay and deductions, and keep bank or wallet details on the employee record.',
  },
  {
    title: 'Calculate the run',
    body: 'PaqadHR computes gross pay, deductions, and net pay, then shows warnings for anyone missing payment details before you approve.',
  },
  {
    title: 'Approve and fund',
    body: 'Approve the run, then fund the payout provider from the workspace. The platform fee and any payout-fee reserve are shown before checkout.',
  },
  {
    title: 'Pay out and keep records',
    body: 'Payouts go to each employee’s destination, payslips are published, and the run keeps the provider references you need for reconciliation.',
  },
];

const rails = [
  ['Nigeria (NGN)', 'Nigerian bank accounts', 'Local bank transfer'],
  ['United States (USD)', 'ACH, wire, or RTP to a US bank account', 'USD bank payout'],
  ['United Kingdom (GBP)', 'Sort code and account number, or a GB IBAN', 'Faster Payments'],
  ['Eurozone (EUR)', 'IBAN and BIC', 'SEPA'],
  [
    'Crypto (USDT / USDC)',
    'TRC20, BEP20, ERC20, SOL, and BASE wallets, depending on the pair',
    'Stablecoin payout',
  ],
] as const;

export default function PayrollPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-6 pb-20 pt-12 md:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Payroll</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] md:text-5xl md:leading-[1.03]">
          Payroll software for Nigerian teams, with international payouts built in.
        </h1>
        <AnswerBlock>
          PaqadHR runs payroll from the same workspace as leave, attendance, and recruitment. It
          calculates gross pay, PAYE, pension, and other deductions, then pays Nigerian employees in
          naira and contractors in USD, EUR, GBP, USDT, or USDC. Payroll is included on every plan,
          with a 2–3% platform fee on payouts depending on tier.
        </AnswerBlock>
        <UpdatedNote updated={CONTENT_UPDATED_AT} />

        <PageSection id="how-it-works" title="What a payroll run looks like">
          <ol className="grid gap-4 md:grid-cols-2">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-[1.2rem] border border-border p-5">
                <p className="text-xs font-semibold text-primary">Step {index + 1}</p>
                <p className="mt-2 text-base font-medium text-foreground">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </PageSection>

        <PageSection id="rails" title="Where PaqadHR can send money">
          <div className="overflow-x-auto rounded-[1.2rem] border border-border">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead className="bg-[#f4f8f6] text-xs uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-4 font-semibold">Destination</th>
                  <th className="px-5 py-4 font-semibold">Required details</th>
                  <th className="px-5 py-4 font-semibold">Rail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rails.map(([region, details, rail]) => (
                  <tr key={region}>
                    <td className="px-5 py-4 font-medium text-foreground">{region}</td>
                    <td className="px-5 py-4 text-muted-foreground">{details}</td>
                    <td className="px-5 py-4 text-muted-foreground">{rail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>

        <PageSection id="compliance" title="The Nigerian payroll checklist">
          <p>
            Payroll in Nigeria is more than salary. Before a run is final, most employers are
            dealing with the following obligations. Rates change, so confirm the current figures
            with the relevant authority rather than relying on any article, including this one.
          </p>
          <ul className="space-y-3">
            <li>
              <strong className="text-foreground">PAYE</strong> — income tax withheld from each
              employee and remitted to the internal revenue service of the state where they reside.
              Nigeria’s 2025 tax reforms, effective January 2026, changed the bands and introduced a
              rent relief, so re-check the current schedule with{' '}
              <a
                className="underline underline-offset-2"
                href="https://www.firs.gov.ng"
                rel="noreferrer"
              >
                FIRS
              </a>
              .
            </li>
            <li>
              <strong className="text-foreground">Pension</strong> — under the Pension Reform Act
              2014, employers with 15 or more employees contribute 10% and employees 8% of monthly
              emoluments. See{' '}
              <a
                className="underline underline-offset-2"
                href="https://www.pencom.gov.ng"
                rel="noreferrer"
              >
                PenCom
              </a>
              .
            </li>
            <li>
              <strong className="text-foreground">National Housing Fund</strong> — 2.5% of monthly
              income for eligible employees, managed by the{' '}
              <a
                className="underline underline-offset-2"
                href="https://www.nhf.gov.ng"
                rel="noreferrer"
              >
                NHF
              </a>
              .
            </li>
            <li>
              <strong className="text-foreground">ITF and NSITF</strong> — 1% of payroll each for
              employers in scope, collected by the{' '}
              <a
                className="underline underline-offset-2"
                href="https://www.itf.gov.ng"
                rel="noreferrer"
              >
                Industrial Training Fund
              </a>{' '}
              and the{' '}
              <a
                className="underline underline-offset-2"
                href="https://www.nsitf.gov.ng"
                rel="noreferrer"
              >
                Nigeria Social Insurance Trust Fund
              </a>
              .
            </li>
            <li>
              <strong className="text-foreground">Health insurance</strong> — formal-sector
              employers contribute under the NHIA scheme. See the{' '}
              <a
                className="underline underline-offset-2"
                href="https://www.nhia.gov.ng"
                rel="noreferrer"
              >
                NHIA
              </a>
              .
            </li>
          </ul>
          <p>
            PaqadHR calculates these lines and keeps the run records. Filing and remitting stay with
            the employer.
          </p>
        </PageSection>

        <PageSection id="faq" title="Payroll questions">
          <FaqList items={faqs} />
        </PageSection>

        <CtaRow secondary={{ href: '/pricing', label: 'See pricing' }} />
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
