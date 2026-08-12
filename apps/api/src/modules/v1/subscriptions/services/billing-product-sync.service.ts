import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  getBachsBaseUrl,
  getBachsSecretKey,
  isBachsConfigured,
} from 'src/common/config/bachs.config';
import { getPolarAccessToken, isPolarConfigured } from 'src/common/config/polar.config';
import { IsNull, Repository } from 'typeorm';
import { PlanPrice } from '../../plans/entities/plan-price.entity';
import {
  getBillingGlobalProvider,
  getBillingNgProvider,
} from '../config/billing-provider-resolver';
import { BillingProvider } from '../constants/billing-provider.enum';

function formatAmount(value: number): string {
  return Number(value).toFixed(2);
}

@Injectable()
export class BillingProductSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BillingProductSyncService.name);

  constructor(
    @InjectRepository(PlanPrice)
    private readonly priceRepo: Repository<PlanPrice>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.warnMissingProductIds();
  }

  /** Warn when a preferred provider is configured but plan_prices lack product IDs. */
  async warnMissingProductIds(): Promise<void> {
    const preferred = new Set([getBillingNgProvider(), getBillingGlobalProvider()]);

    if (preferred.has(BillingProvider.BACHS) && isBachsConfigured()) {
      const missingNgn = await this.priceRepo.count({
        where: { currency: 'NGN', bachsProductId: IsNull(), isActive: true },
      });
      const missingUsd = await this.priceRepo.count({
        where: { currency: 'USD', bachsProductId: IsNull(), isActive: true },
      });

      // NG billing on Bachs requires NGN product IDs — treat as a hard operational gap.
      if (getBillingNgProvider() === BillingProvider.BACHS && missingNgn > 0) {
        this.logger.error(
          `${missingNgn} active NGN plan_prices row(s) missing bachs_product_id while BILLING_NG_PROVIDER=bachs. Run: pnpm --filter api sync:bachs-products`,
        );
      } else if (missingNgn > 0) {
        this.logger.warn(
          `${missingNgn} active NGN plan_prices row(s) missing bachs_product_id. Run: pnpm --filter api sync:bachs-products`,
        );
      }

      if (missingUsd > 0) {
        this.logger.warn(
          `${missingUsd} active USD plan_prices row(s) missing bachs_product_id. Run: pnpm --filter api sync:bachs-products`,
        );
      }
    }

    if (preferred.has(BillingProvider.POLAR) && isPolarConfigured()) {
      const missing = await this.priceRepo.count({
        where: {
          countryCode: 'GLOBAL',
          currency: 'USD',
          polarProductId: IsNull(),
          isActive: true,
        },
      });
      if (missing > 0) {
        this.logger.warn(
          `${missing} GLOBAL/USD plan_prices row(s) missing polar_product_id. Run: pnpm --filter api sync:polar-products`,
        );
      }
    }
  }

  /** Create-or-reuse Bachs products and write IDs onto plan_prices. */
  async syncBachsProducts(): Promise<{ updated: number }> {
    const secretKey = getBachsSecretKey();
    if (!secretKey) {
      throw new Error('BACHS_SECRET_KEY is not set');
    }

    const planPrices = await this.priceRepo.find({
      where: [{ currency: 'NGN' }, { currency: 'USD' }],
      relations: ['plan'],
      order: { plan: { sortOrder: 'ASC' } },
    });

    const existing = await this.bachsRequest<{ items?: Array<Record<string, unknown>> }>(
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
        const created = await this.bachsRequest<{ id: string }>('/v1/products', {
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
            trial_period: null,
            metadata: {
              paqad: 'true',
              plan_slug: slug,
              currency,
            },
          }),
        });
        productId = created.id;
        this.logger.log(`Created Bachs ${slug} ${currency}: ${productId}`);
      } else if (match?.trial_period) {
        // Paqad free trial is in-app only. Bachs product trials make checkout `trialing`
        // (often without charging). Clear trial_period; if the API won't clear it, recreate.
        let cleared = false;
        try {
          await this.bachsRequest(`/v1/products/${productId}`, {
            method: 'PATCH',
            body: JSON.stringify({ trial_period: null }),
          });
          const refreshed = await this.bachsRequest<{ trial_period?: unknown }>(
            `/v1/products/${productId}`,
          );
          cleared = !refreshed.trial_period;
          if (cleared) {
            this.logger.log(`Cleared Bachs trial_period on ${slug} ${currency}: ${productId}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Could not clear trial_period on Bachs product ${productId}: ${message}`,
          );
        }

        if (!cleared) {
          const oldProductId = productId;
          try {
            await this.bachsRequest(`/v1/products/${oldProductId}/archive`, { method: 'POST' });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Could not archive Bachs product ${oldProductId}: ${message}`);
          }
          const created = await this.bachsRequest<{ id: string }>('/v1/products', {
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
              trial_period: null,
              metadata: {
                paqad: 'true',
                plan_slug: slug,
                currency,
                replaces_product_id: oldProductId,
              },
            }),
          });
          this.logger.warn(
            `Recreated Bachs ${slug} ${currency} without trial_period: ${oldProductId} → ${created.id}`,
          );
          productId = created.id;
          const idx = paqadProducts.findIndex((item) => item.id === match?.id);
          if (idx >= 0) paqadProducts.splice(idx, 1);
          paqadProducts.push({
            id: productId,
            metadata: { paqad: 'true', plan_slug: slug, currency },
          });
        }
      }

      if (planPrice.bachsProductId !== productId) {
        planPrice.bachsProductId = productId;
        await this.priceRepo.save(planPrice);
        updated += 1;
      }
    }

    return { updated };
  }

  /** Create-or-reuse Polar products and write IDs onto plan_prices. */
  async syncPolarProducts(): Promise<{ updated: number }> {
    const token = getPolarAccessToken();
    if (!token) {
      throw new Error('POLAR_ACCESS_TOKEN is not set');
    }

    const planPrices = await this.priceRepo.find({
      where: { countryCode: 'GLOBAL', currency: 'USD', isActive: true },
      relations: ['plan'],
      order: { plan: { sortOrder: 'ASC' } },
    });

    const existing = await this.listPaqadPolarProducts();
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
        const created = await this.polarRequest<{ id: string }>('/products/', {
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
                amount_type: 'seat_based',
                price_currency: 'usd',
                seat_tiers: {
                  tiers: [
                    {
                      min_seats: 1,
                      price_per_seat: amountMinor,
                    },
                  ],
                },
              },
            ],
          }),
        });
        productId = created.id;
        this.logger.log(`Created Polar ${slug}: ${productId}`);
      }

      if (planPrice.polarProductId !== productId) {
        planPrice.polarProductId = productId;
        await this.priceRepo.save(planPrice);
        updated += 1;
      }
    }

    return { updated };
  }

  /** Heal missing product IDs when the matching provider token is present. */
  async healMissingProductIds(): Promise<{ bachsUpdated: number; polarUpdated: number }> {
    let bachsUpdated = 0;
    let polarUpdated = 0;

    if (isBachsConfigured()) {
      const missing = await this.priceRepo.count({
        where: [
          { currency: 'NGN', bachsProductId: IsNull(), isActive: true },
          { currency: 'USD', bachsProductId: IsNull(), isActive: true },
        ],
      });
      if (missing > 0) {
        bachsUpdated = (await this.syncBachsProducts()).updated;
      }
    }

    if (isPolarConfigured()) {
      const missing = await this.priceRepo.count({
        where: {
          countryCode: 'GLOBAL',
          currency: 'USD',
          polarProductId: IsNull(),
          isActive: true,
        },
      });
      if (missing > 0) {
        polarUpdated = (await this.syncPolarProducts()).updated;
      }
    }

    return { bachsUpdated, polarUpdated };
  }

  private async listPaqadPolarProducts(): Promise<
    Array<{ id: string; metadata?: Record<string, string> }>
  > {
    const payload = await this.polarRequest<{
      items?: Array<{ id: string; metadata?: Record<string, string> }>;
    }>('/products/?limit=100');
    return (payload.items ?? []).filter((item) => item.metadata?.paqad === 'true');
  }

  private async bachsRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${getBachsBaseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${getBachsSecretKey()}`,
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

  private async polarRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`https://api.polar.sh/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${getPolarAccessToken()}`,
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
}
