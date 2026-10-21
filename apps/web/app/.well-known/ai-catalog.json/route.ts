import { COMPANY, companySameAs } from '@/lib/constants/company';
import {
  LANDING_PRICING_BY_CURRENCY,
  PLAN_CATALOG,
  PLAN_SLUG_ORDER,
} from '@/lib/constants/plan-catalog';
import { PRODUCT_SUMMARY } from '@/lib/seo/site-schema';

/**
 * Machine-readable catalogue for AI agents and discovery tooling. It is a plain
 * restatement of facts that are already on the site — nothing here may be a claim
 * that the site does not make somewhere a human can read.
 */
export const dynamic = 'force-static';

export function GET() {
  const usd = new Map(
    LANDING_PRICING_BY_CURRENCY.USD.map((entry) => [entry.slug, entry.pricePerSeat]),
  );
  const ngn = new Map(
    LANDING_PRICING_BY_CURRENCY.NGN.map((entry) => [entry.slug, entry.pricePerSeat]),
  );

  const catalog = {
    version: '1.0',
    name: COMPANY.productFullName,
    legalName: COMPANY.legalName,
    description: PRODUCT_SUMMARY,
    url: COMPANY.website,
    logo: `${COMPANY.website}/icon.png`,
    categories: ['hr-software', 'payroll-software', 'employee-engagement', 'recruitment'],
    capabilities: [
      'employee directory and org chart',
      'leave management and employee self-service',
      'attendance and shift policies',
      'recruitment with a public careers page',
      'payroll with NGN, USD, EUR, GBP, USDT and USDC payouts',
      'published payslips',
      'Slack integration for peer shoutouts',
      'points-based rewards catalog and redemptions',
    ],
    pricing: {
      model: 'per active user per month',
      currency: ['USD', 'NGN'],
      plans: PLAN_SLUG_ORDER.map((slug) => ({
        name: PLAN_CATALOG[slug].name,
        maxActiveUsers: PLAN_CATALOG[slug].maxEmployees,
        pricePerUser: { USD: usd.get(slug) ?? null, NGN: ngn.get(slug) ?? null },
        payrollPlatformFeePercent: PLAN_CATALOG[slug].payrollFeePercent,
      })),
      url: `${COMPANY.website}/pricing`,
    },
    documentation: [
      { title: 'Payroll', url: `${COMPANY.website}/payroll` },
      { title: 'Employee recognition', url: `${COMPANY.website}/employee-recognition` },
      { title: 'HR software for small teams', url: `${COMPANY.website}/hr-software` },
      { title: 'Security', url: `${COMPANY.website}/security` },
      { title: 'About', url: `${COMPANY.website}/about` },
    ],
    contact: { email: COMPANY.email, url: `${COMPANY.website}/contact` },
    sameAs: companySameAs(),
  };

  return new Response(`${JSON.stringify(catalog, null, 2)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
