import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/json-ld';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import { ContactForm } from '@/features/home/components/contact-form';
import { COMPANY } from '@/lib/constants/company';
import { CONTENT_UPDATED_AT, marketingPage } from '@/lib/constants/marketing-pages';
import { faqPageSchema, organizationSchema, webPageSchema } from '@/lib/seo/site-schema';

const page = marketingPage('/contact')!;

const faqs = [
  {
    question: 'What should I include in a first message?',
    answer:
      'Your company, roughly how many people you pay, the currency and country of your employees, and what you are trying to do — a price check, payroll coverage in a new country, a security review, or a problem with an existing workspace. That is enough for a useful answer without a back-and-forth.',
  },
  {
    question: 'How quickly do you reply?',
    answer:
      'Messages go to the team inbox and are answered in the order they arrive. We do not publish a response-time SLA, so if a reply is time-critical for a payroll date, say so in the message.',
  },
  {
    question: 'Can you send security documentation?',
    answer:
      'Yes. Ask for it and we will send the current security page, the data processing agreement, and our security.txt contact file. If your procurement process needs something we do not have yet, we will say so rather than send a document that does not exist.',
  },
  {
    question: 'Do you offer onboarding support?',
    answer:
      'On larger workspaces, yes — the team will help you load your people, set pay, and run a test payroll before the first live one. Ask for it when you get in touch and tell us your payroll date.',
  },
];

export const metadata: Metadata = {
  title: 'Contact PaqadHR — talk to the team',
  description:
    'Email the PaqadHR team about pricing, payroll coverage, a security review, or an existing workspace. Include your headcount, currency, and country.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact PaqadHR — talk to the team',
    description: page.description,
    url: page.path,
    type: 'website',
  },
};

export default function ContactPage() {
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
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
        <p className="mt-2 text-muted-foreground">
          PaqadHR is built by {COMPANY.legalName}. Email the team with your company, headcount,
          currency, and country, and a person will reply about pricing, payroll coverage, or
          security review.
        </p>

        <div className="mt-6 rounded-[1.4rem] border border-primary/15 bg-[#f2f8f4] px-6 py-6">
          <p className="text-base leading-relaxed text-foreground">
            PaqadHR is built by {COMPANY.legalName}. The fastest way to reach a person is email:{' '}
            <a className="underline underline-offset-2" href={`mailto:${COMPANY.email}`}>
              {COMPANY.email}
            </a>
            . Include your company, the number of people you pay, the currency and country of your
            employees, and what you are trying to do — that is usually enough for a useful reply.
            Security vulnerabilities can be reported to the same address; see the{' '}
            <Link className="underline underline-offset-2" href="/security">
              security page
            </Link>{' '}
            for what to include. We do not run a support chatbot or a ticket queue that nobody reads
            — a person answers, which is why the first message is worth writing carefully.
          </p>
        </div>

        <div className="mt-10 grid gap-12 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Email</p>
            <a href={`mailto:${COMPANY.email}`} className="block hover:text-foreground">
              {COMPANY.email}
            </a>
            <p className="pt-4 font-medium text-foreground">Useful for</p>
            <ul className="space-y-1">
              <li>Pricing and plan questions</li>
              <li>Payroll coverage in your country</li>
              <li>Security review and vendor paperwork</li>
              <li>Existing workspace support</li>
            </ul>
          </div>
          <ContactForm />
        </div>

        <div className="mt-8 border-y border-border">
          {faqs.map((faq) => (
            <div key={faq.question} className="py-5">
              <h3 className="text-base font-semibold text-foreground">{faq.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
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
      </main>

      <JsonLd
        data={[
          organizationSchema(),
          webPageSchema({
            path: page.path,
            name: page.title,
            description: page.description,
            updated: CONTENT_UPDATED_AT,
          }),
          {
            '@context': 'https://schema.org',
            '@type': 'ContactPage',
            '@id': 'https://paqadhr.com/contact#contactpage',
            url: 'https://paqadhr.com/contact',
            name: page.title,
            description: page.description,
            dateModified: CONTENT_UPDATED_AT,
            mainEntity: { '@id': 'https://paqadhr.com/#organization' },
          },
          faqPageSchema(faqs),
        ]}
      />
    </div>
  );
}
