import type { Metadata } from 'next';
import { JsonLd } from '@/components/json-ld';
import { MarketingShell } from '@/components/marketing-shell';
import { AnswerBlock, CtaRow, FaqList, PageSection, UpdatedNote } from '@/components/marketing-ui';
import { CONTENT_UPDATED_AT, marketingPage } from '@/lib/constants/marketing-pages';
import {
  LANDING_PRICING_BY_CURRENCY,
  PLAN_CATALOG,
  PLAN_SLUG_ORDER,
} from '@/lib/constants/plan-catalog';
import { faqPageSchema, productSchema, webPageSchema } from '@/lib/seo/site-schema';

const page = marketingPage('/pricing')!;

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

const usdBySlug = new Map(
  LANDING_PRICING_BY_CURRENCY.USD.map((entry) => [entry.slug, entry.pricePerSeat]),
);
const ngnBySlug = new Map(
  LANDING_PRICING_BY_CURRENCY.NGN.map((entry) => [entry.slug, entry.pricePerSeat]),
);

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const ngn = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const faqs = [
  {
    question: 'How is PaqadHR billed?',
    answer:
      'Per active user, per month. Each plan has a fixed seat price — $3, $5, or $9 in USD, or ₦2,500, ₦3,500, or ₦7,500 in naira — and you pay for the people who are active in your workspace.',
  },
  {
    question: 'Is payroll included in the price?',
    answer:
      'Yes. Payroll is part of every plan rather than a separate module. A payroll platform fee applies to payouts: 3% on Starter, 2.5% on Growth, and 2% on Scale.',
  },
  {
    question: 'What are the plan limits?',
    answer:
      'Starter covers up to 25 active users, Growth up to 100, and Scale up to 500. Pick the tier that matches your headcount; the seat price changes with the tier, not with the size of the payroll.',
  },
  {
    question: 'Can I pay in naira?',
    answer:
      'Yes. PaqadHR publishes prices in both USD and NGN. Naira pricing applies to Nigerian workspaces and USD pricing to international ones, so you are not exposed to an exchange rate on your subscription.',
  },
  {
    question: 'Do I need a separate tool for leave, attendance, or recruitment?',
    answer:
      'No. Leave and employee self-service are on every plan. Attendance, recruitment with a public careers page, Slack integration, reporting, and shoutouts are on Growth and above. Scale adds multi-location reporting, performance management, and API access.',
  },
  {
    question: 'How do I get a quote for a larger team?',
    answer:
      'Email info@paqadhr.com with your headcount, currencies, and countries, and the team will confirm the plan and payroll coverage for your setup.',
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-6 pb-20 pt-12 md:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Pricing</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] md:text-5xl md:leading-[1.03]">
          Pay per active user. Payroll is included.
        </h1>
        <AnswerBlock>
          PaqadHR costs <strong>$3–$9 per active user per month</strong> (₦2,500–₦7,500 in Nigeria),
          depending on plan. Payroll is included on every tier — there is no separate payroll module
          to buy — and the payroll platform fee is 3% on Starter, 2.5% on Growth, and 2% on Scale.
        </AnswerBlock>
        <UpdatedNote updated={CONTENT_UPDATED_AT} />

        <div className="mt-10 overflow-x-auto rounded-[1.2rem] border border-border">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-[#f4f8f6] text-xs uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-5 py-4 font-semibold">Plan</th>
                <th className="px-5 py-4 font-semibold">Per user / month</th>
                <th className="px-5 py-4 font-semibold">Active users</th>
                <th className="px-5 py-4 font-semibold">Payroll fee</th>
                <th className="px-5 py-4 font-semibold">Best for</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PLAN_SLUG_ORDER.map((slug) => {
                const plan = PLAN_CATALOG[slug];
                return (
                  <tr key={slug} className="align-top">
                    <td className="px-5 py-4 font-medium text-foreground">{plan.name}</td>
                    <td className="px-5 py-4 text-foreground">
                      {usd.format(usdBySlug.get(slug) ?? 0)}
                      <span className="block text-xs text-muted-foreground">
                        {ngn.format(ngnBySlug.get(slug) ?? 0)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">Up to {plan.maxEmployees}</td>
                    <td className="px-5 py-4 text-muted-foreground">{plan.payrollFeePercent}%</td>
                    <td className="px-5 py-4 text-muted-foreground">{plan.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <PageSection id="included" title="What each plan includes">
          <div className="grid gap-4 md:grid-cols-3">
            {PLAN_SLUG_ORDER.map((slug) => {
              const plan = PLAN_CATALOG[slug];
              return (
                <div key={slug} className="rounded-[1.2rem] border border-border p-5">
                  <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.tagline}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {plan.highlights.map((highlight) => (
                      <li key={highlight} className="flex gap-2 text-muted-foreground">
                        <span
                          aria-hidden="true"
                          className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary"
                        />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </PageSection>

        <PageSection id="faq" title="Pricing questions">
          <FaqList items={faqs} />
        </PageSection>

        <CtaRow />
      </div>

      <JsonLd
        data={[
          webPageSchema({
            path: page.path,
            name: page.title,
            description: page.description,
            updated: CONTENT_UPDATED_AT,
          }),
          productSchema(),
          faqPageSchema(faqs),
        ]}
      />
    </MarketingShell>
  );
}
