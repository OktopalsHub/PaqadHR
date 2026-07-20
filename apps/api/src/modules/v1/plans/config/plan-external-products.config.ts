type PlanSlug = 'starter' | 'growth' | 'scale';

const PLAN_SLUGS: PlanSlug[] = ['starter', 'growth', 'scale'];

function isPlanSlug(slug: string): slug is PlanSlug {
  return PLAN_SLUGS.includes(slug as PlanSlug);
}

function envKey(prefix: string, slug: PlanSlug, currency?: string): string {
  const base = `${prefix}_${slug.toUpperCase()}`;
  return currency ? `${base}_${currency.toUpperCase()}` : base;
}

export function getBachsProductId(planSlug: string, currency: string): string | null {
  if (!isPlanSlug(planSlug)) return null;
  const code = currency.trim().toUpperCase();
  const specific = process.env[envKey('BACHS_PRODUCT', planSlug, code)]?.trim();
  if (specific) return specific;
  return process.env[envKey('BACHS_PRODUCT', planSlug)]?.trim() || null;
}

export function getPolarProductId(planSlug: string): string | null {
  if (!isPlanSlug(planSlug)) return null;
  return process.env[envKey('POLAR_PRODUCT', planSlug)]?.trim() || null;
}

export interface BachsProductSeedSpec {
  slug: PlanSlug;
  currency: string;
  amount: string;
  name: string;
  envKey: string;
}

export function listBachsProductSeedSpecs(): BachsProductSeedSpec[] {
  const specs: BachsProductSeedSpec[] = [];
  for (const slug of PLAN_SLUGS) {
    for (const currency of ['NGN', 'USD'] as const) {
      specs.push({
        slug,
        currency,
        amount: '',
        name: `PaqadHR ${slug.charAt(0).toUpperCase()}${slug.slice(1)} (${currency})`,
        envKey: envKey('BACHS_PRODUCT', slug, currency),
      });
    }
  }
  return specs;
}
