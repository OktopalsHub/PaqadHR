/**
 * Creates or lists Bachs recurring subscription products for PaqadHR plans.
 * Usage: BACHS_SECRET_KEY=sk_sandbox_... pnpm --filter api sync:bachs-products
 */
import { Logger } from '@nestjs/common';
import { getBachsBaseUrl, getBachsSecretKey } from '../common/config/bachs.config';
import { DEFAULT_PLANS } from '../modules/v1/plans/data/default-plans.data';

const logger = new Logger('SyncBachsProducts');

type PlanSlug = 'starter' | 'growth' | 'scale';

function formatAmount(value: number): string {
  return Number(value).toFixed(2);
}

function envKey(slug: PlanSlug, currency: string): string {
  return `BACHS_PRODUCT_${slug.toUpperCase()}_${currency.toUpperCase()}`;
}

async function bachsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const secretKey = getBachsSecretKey();
  if (!secretKey) {
    throw new Error('BACHS_SECRET_KEY is not set');
  }

  const response = await fetch(`${getBachsBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & { detail?: string };
  if (!response.ok) {
    throw new Error(payload.detail ?? `Bachs API error (${response.status})`);
  }
  return payload;
}

async function syncProducts(): Promise<void> {
  const specs: Array<{ slug: PlanSlug; currency: string; amount: number; name: string }> = [];

  for (const plan of DEFAULT_PLANS) {
    const slug = plan.slug as PlanSlug;
    for (const price of plan.prices) {
      const currency = price.currency.toUpperCase();
      if (currency !== 'NGN' && currency !== 'USD') continue;
      specs.push({
        slug,
        currency,
        amount: price.regionalConfig.pricePerUser,
        name: `PaqadHR ${plan.name} (${currency})`,
      });
    }
  }

  const existing = await bachsRequest<{ items?: Array<Record<string, unknown>> }>(
    '/v1/products?limit=100',
  );
  const paqadProducts = (existing.items ?? []).filter((item) => {
    const metadata = item.metadata as Record<string, string> | undefined;
    return metadata?.paqad === 'true';
  });

  const envLines: string[] = [];

  for (const spec of specs) {
    const match = paqadProducts.find((item) => {
      const metadata = item.metadata as Record<string, string> | undefined;
      return metadata?.plan_slug === spec.slug && metadata?.currency === spec.currency;
    });

    let productId = typeof match?.id === 'string' ? match.id : undefined;

    if (!productId) {
      const created = await bachsRequest<{ id: string }>('/v1/products', {
        method: 'POST',
        body: JSON.stringify({
          name: spec.name,
          description: `PaqadHR ${spec.slug} plan — per seat / month`,
          price: {
            price_type: 'fixed',
            currency: spec.currency,
            amount: formatAmount(spec.amount),
          },
          billing_cycle: { interval: 'month', frequency: 1 },
          metadata: {
            paqad: 'true',
            plan_slug: spec.slug,
            currency: spec.currency,
          },
        }),
      });
      productId = created.id;
      logger.log(`Created ${spec.slug} ${spec.currency}: ${productId}`);
    } else {
      logger.log(`Found ${spec.slug} ${spec.currency}: ${productId}`);
    }

    envLines.push(`${envKey(spec.slug, spec.currency)}=${productId}`);
  }

  console.log('\n# Copy into apps/api/.env\n');
  for (const line of envLines) {
    console.log(line);
  }
}

syncProducts()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    logger.error(error.message, error.stack);
    process.exit(1);
  });
