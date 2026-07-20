/**
 * Creates or reuses Polar recurring products and stores IDs on plan_prices.polar_product_id.
 * Usage: POLAR_ACCESS_TOKEN=pat_... pnpm --filter api sync:polar-products
 */
import { Logger } from '@nestjs/common';
import { getPolarAccessToken } from '../common/config/polar.config';
import dataSource from '../common/database/config/data-source';
import { PlanPrice } from '../modules/v1/plans/entities/plan-price.entity';

const logger = new Logger('SyncPolarProducts');
const POLAR_API = 'https://api.polar.sh/v1';

type PolarProduct = {
  id: string;
  name?: string;
  metadata?: Record<string, string>;
};

async function polarRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getPolarAccessToken();
  if (!token) {
    throw new Error('POLAR_ACCESS_TOKEN is not set');
  }

  const response = await fetch(`${POLAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & { detail?: string };
  if (!response.ok) {
    throw new Error(payload.detail ?? `Polar API error (${response.status})`);
  }
  return payload;
}

async function listPaqadPolarProducts(): Promise<PolarProduct[]> {
  const payload = await polarRequest<{ items?: PolarProduct[] }>('/products/?limit=100');
  return (payload.items ?? []).filter((item) => item.metadata?.paqad === 'true');
}

async function syncProducts(): Promise<void> {
  dataSource.setOptions({ migrationsRun: false });
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const priceRepo = dataSource.getRepository(PlanPrice);
  const planPrices = await priceRepo.find({
    where: { countryCode: 'GLOBAL', currency: 'USD', isActive: true },
    relations: ['plan'],
    order: { plan: { sortOrder: 'ASC' } },
  });

  const existing = await listPaqadPolarProducts();
  let updated = 0;

  for (const planPrice of planPrices) {
    const slug = planPrice.plan?.slug;
    if (!slug) continue;

    const amountMinor = Math.round(
      (planPrice.regionalConfig?.pricePerUser ?? Number(planPrice.monthlyPrice)) * 100,
    );
    const name = `PaqadHR ${planPrice.plan?.name ?? slug}`;

    const match = existing.find((item) => item.metadata?.plan_slug === slug);

    let productId = match?.id;

    if (!productId) {
      const created = await polarRequest<PolarProduct>('/products/', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: `PaqadHR ${slug} plan — per seat / month`,
          visibility: 'private',
          recurring_interval: 'month',
          recurring_interval_count: 1,
          metadata: {
            paqad: 'true',
            plan_slug: slug,
          },
          prices: [
            {
              amount_type: 'fixed',
              price_amount: amountMinor,
              price_currency: 'usd',
            },
          ],
        }),
      });
      productId = created.id;
      logger.log(`Created ${slug}: ${productId}`);
    } else {
      logger.log(`Found ${slug}: ${productId}`);
    }

    if (planPrice.polarProductId !== productId) {
      planPrice.polarProductId = productId;
      await priceRepo.save(planPrice);
      updated += 1;
      logger.log(`Updated plan_prices ${planPrice.id} → polar_product_id=${productId}`);
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
