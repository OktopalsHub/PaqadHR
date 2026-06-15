import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DEFAULT_PLANS } from '../data/default-plans.data';
import { Plan } from '../entities/plan.entity';
import type { PlanPrice } from '../entities/plan-price.entity';
import type { PlansService } from './plans.service';

@Injectable()
export class PlanSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlanSeederService.name);

  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    private readonly plansService: PlansService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const planCount = await this.planRepository.count();
    if (planCount > 0) {
      return;
    }
    await this.seedPlans();
  }

  async seedPlans(): Promise<PlanPrice[]> {
    this.logger.log('Seeding default HR plans...');
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
        this.logger.log(`Seeded ${planData.name} (${priceData.countryCode}/${priceData.currency})`);
      }
    }

    this.logger.log(`Successfully seeded ${prices.length} plan prices`);
    return prices;
  }
}
