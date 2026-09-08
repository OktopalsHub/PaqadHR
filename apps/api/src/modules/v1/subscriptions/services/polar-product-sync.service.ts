import { Logger } from '@nestjs/common';
import { getPolarAccessToken } from 'src/common/config/polar.config';
import { Repository } from 'typeorm';
import { PlanPrice } from '../../plans/entities/plan-price.entity';

export class PolarProductSyncService {
  private readonly logger = new Logger(PolarProductSyncService.name);

  constructor(private readonly priceRepo: Repository<PlanPrice>) {}

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

  private async listPaqadPolarProducts(): Promise<
    Array<{ id: string; metadata?: Record<string, string> }>
  > {
    const payload = await this.polarRequest<{
      items?: Array<{ id: string; metadata?: Record<string, string> }>;
    }>('/products/?limit=100');
    return (payload.items ?? []).filter((item) => item.metadata?.paqad === 'true');
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
