import type { Metadata } from 'next';
import { JsonLd } from '@/components/json-ld';
import { MarketingShell } from '@/components/marketing-shell';
import { AnswerBlock, CtaRow, FaqList, PageSection, UpdatedNote } from '@/components/marketing-ui';
import { CONTENT_UPDATED_AT, marketingPage } from '@/lib/constants/marketing-pages';
import { faqPageSchema, webPageSchema } from '@/lib/seo/site-schema';

/**
 * This page looks the same to every visitor, so it is served from the edge
 * cache and revalidated every 60 seconds instead of being rendered per request.
 */
export const revalidate = 60;

const page = marketingPage('/hr-software')!;

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

const comparison = [
  [
    'Employee records',
    'One row per person, copied between tabs',
    'One record, with roles and reporting lines',
  ],
  [
    'Leave',
    'Requests in chat, balances in a sheet',
    'Request, approval, and balance tracking in one flow',
  ],
  [
    'Payroll',
    'Manual calculation, bank app, then a receipt in email',
    'Calculate, approve, fund, and pay from the run',
  ],
  [
    'Payslips',
    'A PDF recreated every month',
    'Published per employee, with optional email on publish',
  ],
  ['Hiring', 'A folder of CVs', 'Job openings and a public careers page on Growth'],
  [
    'Recognition',
    'A message that scrolls away',
    'Shoutouts with points and a rewards catalog on Growth',
  ],
] as const;

const faqs = [
  {
    question: 'What is HR software for a small team?',
    answer:
      'It is one system for the records and workflows a small company runs every month: who works for you, what they are paid, when they take leave, and how they are paid. For a small team the point is not a deeper feature list than an enterprise suite — it is that payroll, leave, and records agree with each other without someone reconciling spreadsheets.',
  },
  {
    question: 'When should a small team stop using spreadsheets?',
    answer:
      'The usual trigger is payroll. Once a spreadsheet has to survive a mid-month raise, a new hire, a leaver, and a tax change in the same month, the cost of maintaining it exceeds the cost of a tool. The second trigger is leave balances, which quietly drift out of date when two people can edit the sheet.',
  },
  {
    question: 'How many people can PaqadHR handle?',
    answer:
      'Starter covers up to 25 active users, Growth up to 100, and Scale up to 500. Pricing is per active user per month, so a small team does not pay enterprise rates to start.',
  },
  {
    question: 'Can we use payroll without the other modules?',
    answer:
      'Yes. Starter includes the employee directory, leave, employee self-service, and payroll. Attendance, recruitment, Slack, reporting, and recognition are added on Growth.',
  },
  {
    question: 'Does it work for a team spread across countries?',
    answer:
      'PaqadHR calculates in the workspace currency and pays Nigerian employees in naira, with USD, EUR, GBP, USDT, and USDC payouts available for international team members.',
  },
  {
    question: 'Where does our data live, and who can see it?',
    answer:
      'Each workspace is a separate tenant, and every query is scoped to that tenant. Access inside a workspace is role-based, so administrators, managers, and employees see different things. The security page explains the controls in more detail.',
  },
];

export default function HrSoftwarePage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-6 pb-20 pt-12 md:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          HR software
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] md:text-5xl md:leading-[1.03]">
          HR software for small teams that have outgrown the spreadsheet.
        </h1>
        <AnswerBlock>
          PaqadHR is HR software for small teams: employee records, leave, attendance, recruitment,
          and payroll in one workspace. It is priced per active user — $3–$9 or ₦2,500–₦7,500 per
          month — and payroll is included on every plan, so a team of ten is not paying for an
          enterprise suite.
        </AnswerBlock>
        <UpdatedNote updated={CONTENT_UPDATED_AT} />

        <PageSection id="spreadsheets" title="What changes when the spreadsheet goes away">
          <div className="overflow-x-auto rounded-[1.2rem] border border-border">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="bg-[#f4f8f6] text-xs uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-4 font-semibold">Job</th>
                  <th className="px-5 py-4 font-semibold">Spreadsheet</th>
                  <th className="px-5 py-4 font-semibold">PaqadHR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comparison.map(([job, sheet, paqad]) => (
                  <tr key={job}>
                    <td className="px-5 py-4 font-medium text-foreground">{job}</td>
                    <td className="px-5 py-4 text-muted-foreground">{sheet}</td>
                    <td className="px-5 py-4 text-muted-foreground">{paqad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>

        <PageSection id="what-you-get" title="What a small team gets on day one">
          <ul className="space-y-3">
            <li>
              <strong className="text-foreground">A single employee record.</strong> Directory,
              reporting lines, compensation, and payment details in one place instead of four.
            </li>
            <li>
              <strong className="text-foreground">Leave that tracks itself.</strong> Requests,
              approvals, and balances, with self-service so an administrator is not the bottleneck.
            </li>
            <li>
              <strong className="text-foreground">Payroll in the same system.</strong> Calculate,
              approve, fund, and pay — in naira for Nigerian staff and in USD, EUR, GBP, or
              stablecoins for contractors.
            </li>
            <li>
              <strong className="text-foreground">A public careers page.</strong> On Growth, job
              openings get a page candidates can apply through, instead of a folder of CVs.
            </li>
          </ul>
        </PageSection>

        <PageSection id="faq" title="Questions small teams ask">
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
