import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DEFAULT_PLANS } from '../data/default-plans.data';
import type { PlanPrice } from '../entities/plan-price.entity';
import { PlansService } from './plans.service';

@Injectable()
export class PlanSeederService implements OnApplicationBootstrap {
  constructor(private readonly plansService: PlansService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedPlans();
  }

  async seedPlans(): Promise<PlanPrice[]> {
    const prices: PlanPrice[] = [];

    for (const planData of DEFAULT_PLANS) {
      for (const priceData of planData.prices) {
        const price = await this.plansService.upsertPlanWithPrice({
          slug: planData.slug,
          name: planData.name,
          description: planData.description,
          sortOrder: planData.sortOrder,
          features: planData.features,
          limits: planData.limits,
          countryCode: priceData.countryCode,
          currency: priceData.currency,
          monthlyPrice: priceData.monthlyPrice,
          yearlyPrice: priceData.yearlyPrice,
          regionalConfig: priceData.regionalConfig,
        });
        prices.push(price);
      }
    }

    return prices;
  }
}
