import { Logger } from '@nestjs/common';
import { getBachsBaseUrl, getBachsSecretKey } from 'src/common/config/bachs.config';
import { Repository } from 'typeorm';
import { PlanPrice } from '../../plans/entities/plan-price.entity';

function formatAmount(value: number): string {
  return Number(value).toFixed(2);
}

function planPriceAmount(planPrice: PlanPrice): number {
  return planPrice.regionalConfig?.pricePerUser ?? Number(planPrice.monthlyPrice);
}

function siblingCurrency(primary: string): 'NGN' | 'USD' | null {
  const upper = primary.toUpperCase();
  if (upper === 'USD') return 'NGN';
  if (upper === 'NGN') return 'USD';
  return null;
}

export class BachsProductSyncService {
  private readonly logger = new Logger(BachsProductSyncService.name);

  constructor(private readonly priceRepo: Repository<PlanPrice>) {}

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

    const bySlugCurrency = new Map<string, PlanPrice>();
    for (const row of planPrices) {
      const slug = row.plan?.slug;
      if (!slug) continue;
      bySlugCurrency.set(`${slug}:${row.currency.toUpperCase()}`, row);
    }

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

      const amount = planPriceAmount(planPrice);
      const name = `PaqadHR ${planPrice.plan?.name ?? slug} (${currency})`;
      const currencyOptions = this.buildBachsCurrencyOptions(slug, currency, bySlugCurrency);

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
              ...(currencyOptions ? { currency_options: currencyOptions } : {}),
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
                ...(currencyOptions ? { currency_options: currencyOptions } : {}),
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

      if (productId) {
        await this.syncBachsProductCurrencyOptions(productId, currency, amount, currencyOptions);
      }

      if (planPrice.bachsProductId !== productId) {
        planPrice.bachsProductId = productId;
        await this.priceRepo.save(planPrice);
        updated += 1;
      }
    }

    return { updated };
  }

  private buildBachsCurrencyOptions(
    slug: string,
    primaryCurrency: string,
    bySlugCurrency: Map<string, PlanPrice>,
  ): Record<string, string> | null {
    const sibling = siblingCurrency(primaryCurrency);
    if (!sibling) return null;
    const siblingRow = bySlugCurrency.get(`${slug}:${sibling}`);
    if (!siblingRow) return null;
    return { [sibling]: formatAmount(planPriceAmount(siblingRow)) };
  }

  private async syncBachsProductCurrencyOptions(
    productId: string,
    currency: string,
    amount: number,
    currencyOptions: Record<string, string> | null,
  ): Promise<void> {
    try {
      await this.bachsRequest(`/v1/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          price: {
            price_type: 'fixed',
            currency,
            amount: formatAmount(amount),
            ...(currencyOptions ? { currency_options: currencyOptions } : {}),
          },
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not sync currency_options on Bachs product ${productId}: ${message}`);
    }
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
}
