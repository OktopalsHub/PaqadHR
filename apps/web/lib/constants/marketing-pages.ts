/**
 * The public marketing surface.
 *
 * This is the single source of truth for what gets linked in the footer, listed in
 * the sitemap, asserted by tests, and checked by the AI-readiness report. Adding a
 * page here keeps it discoverable by crawlers (including AI crawlers that never run
 * JavaScript) without a second list drifting out of date.
 */
export type MarketingPage = {
  path: string;
  label: string;
  title: string;
  description: string;
  /** Visible "last reviewed" date. Keep it honest: refresh the copy when you bump it. */
  updated: string;
  changeFrequency: 'weekly' | 'monthly' | 'yearly';
  priority: number;
  /**
   * The buyer questions this page is written to answer. AI answer engines match a
   * question to a passage; these are the questions we are deliberately answering, so
   * the readiness report can show which queries have no page behind them.
   */
  targetQueries: string[];
};

export const CONTENT_UPDATED_AT = '2026-10-20';

export const MARKETING_PAGES: readonly MarketingPage[] = [
  {
    path: '/',
    label: 'Home',
    title: 'PaqadHR — HR, payroll & recognition in one workspace',
    description:
      'Hire, pay, and recognize your people in one workspace. Recruitment, payroll, leave management, and Slack shoutouts for growing teams.',
    updated: CONTENT_UPDATED_AT,
    changeFrequency: 'weekly',
    priority: 1,
    targetQueries: [
      'hr and payroll software for african teams',
      'all in one hr and payroll platform',
      'employee management software with payroll',
    ],
  },
  {
    path: '/pricing',
    label: 'Pricing',
    title: 'Pricing — per active user, payroll included',
    description:
      'PaqadHR costs $3–$9 per active user per month (₦2,500–₦7,500 in Nigeria), with payroll included on every plan.',
    updated: CONTENT_UPDATED_AT,
    changeFrequency: 'monthly',
    priority: 0.9,
    targetQueries: [
      'how much does hr software cost in nigeria',
      'payroll software pricing per employee',
      'hr software pricing for small teams',
    ],
  },
  {
    path: '/payroll',
    label: 'Payroll',
    title: 'Payroll software for Nigerian teams',
    description:
      'Run payroll in NGN, USD, EUR, and GBP with PAYE-ready calculations, payslips, and bank payouts from one workspace.',
    updated: CONTENT_UPDATED_AT,
    changeFrequency: 'monthly',
    priority: 0.9,
    targetQueries: [
      'payroll software in nigeria',
      'how to run payroll in nigeria',
      'paye and pension deductions in nigeria',
      'pay employees in naira and usd',
    ],
  },
  {
    path: '/employee-recognition',
    label: 'Recognition',
    title: 'Employee recognition software with Slack shoutouts',
    description:
      'Peer-to-peer shoutouts in Slack, a points balance, and a rewards catalog your team can actually redeem.',
    updated: CONTENT_UPDATED_AT,
    changeFrequency: 'monthly',
    priority: 0.8,
    targetQueries: [
      'employee recognition software with slack',
      'peer to peer employee recognition app',
      'slack shoutout rewards',
    ],
  },
  {
    path: '/hr-software',
    label: 'HR software',
    title: 'HR software for small teams',
    description:
      'Employee records, leave, attendance, recruitment, and payroll in one workspace — without enterprise overhead.',
    updated: CONTENT_UPDATED_AT,
    changeFrequency: 'monthly',
    priority: 0.8,
    targetQueries: [
      'hr software for small teams',
      'best hr software for startups',
      'migrate from spreadsheets to hr software',
    ],
  },
  {
    path: '/about',
    label: 'About',
    title: 'About PaqadHR and Oktopals Limited',
    description:
      'PaqadHR is built by Oktopals Limited for African teams that need payroll, leave, recruitment, and recognition in one place.',
    updated: CONTENT_UPDATED_AT,
    changeFrequency: 'yearly',
    priority: 0.6,
    targetQueries: ['who makes paqadhr', 'is paqadhr a registered company'],
  },
  {
    path: '/security',
    label: 'Security',
    title: 'Security and data protection at PaqadHR',
    description:
      'Tenant isolation, role-based access, httpOnly sessions, strict CSP, and audited administrative actions.',
    updated: CONTENT_UPDATED_AT,
    changeFrequency: 'yearly',
    priority: 0.6,
    targetQueries: [
      'is paqadhr secure',
      'hr software security review checklist',
      'does paqadhr have soc 2',
    ],
  },
  {
    path: '/contact',
    label: 'Contact',
    title: 'Contact the PaqadHR team',
    description: 'Ask about pricing, payroll coverage, security review, or anything else.',
    updated: CONTENT_UPDATED_AT,
    changeFrequency: 'yearly',
    priority: 0.5,
    targetQueries: ['contact paqadhr support'],
  },
  {
    path: '/privacy',
    label: 'Privacy',
    title: 'Privacy Policy',
    description: 'How PaqadHR collects, uses, and protects personal data.',
    updated: CONTENT_UPDATED_AT,
    changeFrequency: 'yearly',
    priority: 0.4,
    targetQueries: [],
  },
  {
    path: '/terms',
    label: 'Terms',
    title: 'Terms of Service',
    description: 'The terms that govern use of PaqadHR.',
    updated: CONTENT_UPDATED_AT,
    changeFrequency: 'yearly',
    priority: 0.4,
    targetQueries: [],
  },
  {
    path: '/dpa',
    label: 'DPA',
    title: 'Data Processing Agreement',
    description: 'The data processing terms between Oktopals Limited and its customers.',
    updated: CONTENT_UPDATED_AT,
    changeFrequency: 'yearly',
    priority: 0.3,
    targetQueries: [],
  },
  {
    path: '/cookies',
    label: 'Cookies',
    title: 'Cookie Policy',
    description: 'Which cookies PaqadHR sets and why.',
    updated: CONTENT_UPDATED_AT,
    changeFrequency: 'yearly',
    priority: 0.3,
    targetQueries: [],
  },
] as const;

export function marketingPage(path: string): MarketingPage | undefined {
  return MARKETING_PAGES.find((page) => page.path === path);
}

/** Every buyer question the marketing surface claims to answer, de-duplicated. */
export function targetQueries(): string[] {
  return [...new Set(MARKETING_PAGES.flatMap((page) => page.targetQueries))];
}
