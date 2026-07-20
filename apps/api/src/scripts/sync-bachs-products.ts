/**
 * Creates or reuses Bachs recurring products and stores IDs on plan_prices.bachs_product_id.
 * Usage: BACHS_SECRET_KEY=sk_sandbox_... pnpm --filter api sync:bachs-products
 */
import { Logger } from '@nestjs/common';
import { getBachsBaseUrl, getBachsSecretKey } from '../common/config/bachs.config';
import dataSource from '../common/database/config/data-source';
import { PlanPrice } from '../modules/v1/plans/entities/plan-price.entity';

const logger = new Logger('SyncBachsProducts');

function formatAmount(value: number): string {
  return Number(value).toFixed(2);
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
  dataSource.setOptions({ migrationsRun: false });
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const priceRepo = dataSource.getRepository(PlanPrice);
  const planPrices = await priceRepo.find({
    where: [{ currency: 'NGN' }, { currency: 'USD' }],
    relations: ['plan'],
    order: { plan: { sortOrder: 'ASC' } },
  });

  const existing = await bachsRequest<{ items?: Array<Record<string, unknown>> }>(
    '/v1/products?limit=100',
  );
  const paqadProducts = (existing.items ?? []).filter((item) => {
    const metadata = item.metadata as Record<string, string> | undefined;
    return metadata?.paqad === 'true';
  });

  let updated = 0;

  for (const planPrice of planPrices) {
    const slug = planPrice.plan?.slug;
    if (!slug) continue;

    const currency = planPrice.currency.toUpperCase();
    if (currency !== 'NGN' && currency !== 'USD') continue;

    const amount = planPrice.regionalConfig?.pricePerUser ?? Number(planPrice.monthlyPrice);
    const name = `PaqadHR ${planPrice.plan?.name ?? slug} (${currency})`;

    const match = paqadProducts.find((item) => {
      const metadata = item.metadata as Record<string, string> | undefined;
      return metadata?.plan_slug === slug && metadata?.currency === currency;
    });

    let productId = typeof match?.id === 'string' ? match.id : undefined;

    if (!productId) {
      const created = await bachsRequest<{ id: string }>('/v1/products', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: `PaqadHR ${slug} plan — per seat / month`,
          price: {
            price_type: 'fixed',
            currency,
            amount: formatAmount(amount),
          },
          billing_cycle: { interval: 'month', frequency: 1 },
          trial_period: { interval: 'day', frequency: 14 },
          metadata: {
            paqad: 'true',
            plan_slug: slug,
            currency,
          },
        }),
      });
      productId = created.id;
      logger.log(`Created ${slug} ${currency}: ${productId}`);
    } else {
      logger.log(`Found ${slug} ${currency}: ${productId}`);
    }

    if (planPrice.bachsProductId !== productId) {
      planPrice.bachsProductId = productId;
      await priceRepo.save(planPrice);
      updated += 1;
      logger.log(`Updated plan_prices ${planPrice.id} → bachs_product_id=${productId}`);
    }
  }

  logger.log(`Done. ${updated} plan price row(s) updated.`);

  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}

syncProducts()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    logger.error(error.message, error.stack);
    process.exit(1);
  });
