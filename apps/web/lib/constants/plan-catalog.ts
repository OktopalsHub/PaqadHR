export type PlanSlug = 'starter' | 'growth' | 'scale';

export interface PlanCatalogEntry {
  slug: PlanSlug;
  name: string;
  description: string;
  tagline: string;
  maxEmployees: number;
  payrollFeePercent: number;
  highlights: string[];
  sortOrder: number;
}

export const PLAN_SLUG_ORDER: PlanSlug[] = ['starter', 'growth', 'scale'];

export const PLAN_CATALOG: Record<PlanSlug, PlanCatalogEntry> = {
  starter: {
    slug: 'starter',
    name: 'Starter',
    description: 'Core HR for small teams getting started.',
    tagline: 'Run HR + payroll without enterprise overhead',
    maxEmployees: 25,
    payrollFeePercent: 3,
    sortOrder: 0,
    highlights: [
      'Employee directory & org chart',
      'Leave management & self-service',
      'Payroll runs, bank export & manual payouts',
      'Employee self-service workflows',
      'Core HR workflows for lean teams',
    ],
  },
  growth: {
    slug: 'growth',
    name: 'Growth',
    description: 'HR + integrations for scaling teams.',
    tagline: 'Integrate, report, and reward as you grow',
    maxEmployees: 100,
    payrollFeePercent: 2.5,
    sortOrder: 1,
    highlights: [
      'Everything in Starter',
      'Attendance, policies & clock-in',
      'Recruitment & careers page',
      'Slack integration',
      'Advanced reporting & analytics',
      'Shoutouts, rewards & redemptions',
      '2.5% payroll platform fee',
    ],
  },
  scale: {
    slug: 'scale',
    name: 'Scale',
    description: 'Full platform for established HR operations.',
    tagline: 'Compliance, API, and advanced payroll',
    maxEmployees: 500,
    payrollFeePercent: 2,
    sortOrder: 2,
    highlights: [
      'Everything in Growth',
      'Multi-location & compliance reporting',
      'Performance management & API access',
      'Priority support',
      '2% payroll platform fee',
    ],
  },
};

export function isPlanSlug(slug: string): slug is PlanSlug {
  return slug in PLAN_CATALOG;
}

export function getPlanCatalog(slug: string): PlanCatalogEntry | undefined {
  return isPlanSlug(slug) ? PLAN_CATALOG[slug] : undefined;
}

export function sortPlansByTier<T extends { slug: string }>(plans: T[]): T[] {
  return [...plans].sort((a, b) => {
    const orderA = getPlanCatalog(a.slug)?.sortOrder ?? 99;
    const orderB = getPlanCatalog(b.slug)?.sortOrder ?? 99;
    return orderA - orderB;
  });
}

export const LANDING_PRICING_BY_CURRENCY: Record<
  string,
  Array<{ slug: PlanSlug; pricePerSeat: number; currency: string }>
> = {
  USD: [
    { slug: 'starter', pricePerSeat: 3, currency: 'USD' },
    { slug: 'growth', pricePerSeat: 5, currency: 'USD' },
    { slug: 'scale', pricePerSeat: 9, currency: 'USD' },
  ],
  NGN: [
    { slug: 'starter', pricePerSeat: 2500, currency: 'NGN' },
    { slug: 'growth', pricePerSeat: 3500, currency: 'NGN' },
    { slug: 'scale', pricePerSeat: 7500, currency: 'NGN' },
  ],
};
