import type { Metadata } from 'next';
import { JsonLd } from '@/components/json-ld';
import { MarketingShell } from '@/components/marketing-shell';
import { AnswerBlock, CtaRow, FaqList, PageSection, UpdatedNote } from '@/components/marketing-ui';
import { CONTENT_UPDATED_AT, marketingPage } from '@/lib/constants/marketing-pages';
import { faqPageSchema, webPageSchema } from '@/lib/seo/site-schema';

const page = marketingPage('/employee-recognition')!;

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

const steps = [
  {
    title: 'A teammate is recognised in Slack',
    body: 'Anyone can post a shoutout from the channel where the work happened. The recognition lands in the workspace feed next to the leave, attendance, and payroll records for the same team.',
  },
  {
    title: 'The shoutout earns points',
    body: 'Recognition carries a points value that accumulates in the employee’s rewards balance, so appreciation turns into something the person can actually use.',
  },
  {
    title: 'Points are redeemed from your catalog',
    body: 'Admins define what points can buy — an extra day off, lunch with the founder, a team outing, or a digital reward — and approve redemptions from the workspace.',
  },
];

const faqs = [
  {
    question: 'Do we need Slack to use employee recognition?',
    answer:
      'No. Shoutouts work inside PaqadHR. The Slack integration posts recognition into the channels your team already uses, which is usually the difference between a recognition programme people see and one they forget.',
  },
  {
    question: 'How do reward points work?',
    answer:
      'Each shoutout credits points to the employee who received it. Points sit in the workspace rewards balance, and employees redeem them against a catalog that your administrators control.',
  },
  {
    question: 'Which plan includes shoutouts and rewards?',
    answer:
      'Shoutouts, rewards, redemptions, and the Slack integration are on the Growth plan and above. Starter covers the employee directory, leave, and payroll.',
  },
  {
    question: 'Can we limit what employees can redeem?',
    answer:
      'Yes. The rewards catalog belongs to your workspace, so you decide which perks exist and approve redemptions before anything is issued.',
  },
  {
    question: 'Is recognition separate from HR records?',
    answer:
      'No. Recognition sits in the same workspace as the employee directory, so a shoutout is attached to a real employee record rather than a separate list that drifts out of date.',
  },
];

export default function EmployeeRecognitionPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-6 pb-20 pt-12 md:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Recognition
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] md:text-5xl md:leading-[1.03]">
          Employee recognition that happens where your team already talks.
        </h1>
        <AnswerBlock>
          PaqadHR adds peer-to-peer shoutouts to Slack. A teammate is recognised in the channel
          where the work happened, the shoutout earns points, and those points are redeemed from a
          rewards catalog your administrators control. It runs inside the same workspace as your
          employee records, leave, and payroll, on the Growth plan and above.
        </AnswerBlock>
        <UpdatedNote updated={CONTENT_UPDATED_AT} />

        <PageSection id="how-it-works" title="How recognition works">
          <ol className="space-y-4">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-[1.2rem] border border-border p-5">
                <p className="text-xs font-semibold text-primary">Step {index + 1}</p>
                <p className="mt-2 text-base font-medium text-foreground">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </PageSection>

        <PageSection id="why-slack" title="Why Slack-first recognition works better">
          <p>
            Recognition fails quietly when it lives in a tool nobody opens. Posting a shoutout in
            the channel where a project shipped means the recognition is seen by the people who
            watched the work happen — and the reward is attached to a real employee record instead
            of a spreadsheet someone has to maintain.
          </p>
          <p>
            The same workspace also holds leave, attendance, and payroll, so a recognition programme
            does not become a fourth login for your team.
          </p>
        </PageSection>

        <PageSection id="faq" title="Recognition questions">
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
