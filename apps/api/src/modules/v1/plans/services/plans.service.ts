import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { PlanRegionalConfig } from '../../../../common/interfaces/plan-regional-config.interface';
import { Plan } from '../entities/plan.entity';
import { PlanPrice } from '../entities/plan-price.entity';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    @InjectRepository(PlanPrice)
    private readonly planPriceRepository: Repository<PlanPrice>,
  ) {}
  async findAllPlans(): Promise<Plan[]> {
    return this.planRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
      relations: ['prices'],
    });
  }
  async findPlanBySlug(slug: string): Promise<Plan | null> {
    return this.planRepository.findOne({
      where: { slug, isActive: true },
      relations: ['prices'],
    });
  }
  async getPricesForCountry(countryCode: string): Promise<PlanPrice[]> {
    const prices = await this.planPriceRepository.find({
      where: { countryCode, isActive: true },
      relations: ['plan'],
      order: { plan: { sortOrder: 'ASC' } },
    });
    if (prices.length > 0) {
      return prices;
    }
    return this.planPriceRepository.find({
      where: { countryCode: 'GLOBAL', isActive: true },
      relations: ['plan'],
      order: { plan: { sortOrder: 'ASC' } },
    });
  }
  async getPlanPrice(
    planSlug: string,
    countryCode: string,
    currency?: string,
  ): Promise<PlanPrice | null> {
    const plan = await this.findPlanBySlug(planSlug);
    if (!plan) return null;
    const where: Record<string, unknown> = {
      planId: plan.id,
      countryCode,
      isActive: true,
    };
    if (currency) where.currency = currency;
    let price = await this.planPriceRepository.findOne({
      where,
      relations: ['plan'],
    });
    if (!price && countryCode !== 'GLOBAL') {
      const globalWhere = { ...where, countryCode: 'GLOBAL' };
      price = await this.planPriceRepository.findOne({
        where: globalWhere,
        relations: ['plan'],
      });
    }
    return price;
  }
  async createPlan(data: Partial<Plan>): Promise<Plan> {
    const plan = this.planRepository.create(data);
    return this.planRepository.save(plan);
  }
  async createPlanPrice(data: Partial<PlanPrice>): Promise<PlanPrice> {
    const price = this.planPriceRepository.create(data);
    return this.planPriceRepository.save(price);
  }
  async updatePlanPrice(id: string, updates: Partial<PlanPrice>): Promise<PlanPrice> {
    await this.planPriceRepository.update(
      id,
      updates as Parameters<typeof this.planPriceRepository.update>[1],
    );
    const price = await this.planPriceRepository.findOne({
      where: { id },
      relations: ['plan'],
    });
    if (!price) {
      throw new NotFoundException('Plan price not found');
    }
    return price;
  }
  calculatePrice(
    planPrice: PlanPrice,
    userCount: number,
  ): {
    basePrice: number;
    overagePrice: number;
    totalPrice: number;
    currency: string;
    payrollFeePercentage: number;
    breakdown: ReturnType<PlanPrice['calculateMonthlyPrice']>;
  } {
    const breakdown = planPrice.calculateMonthlyPrice(userCount);
    return {
      basePrice: breakdown.basePrice,
      overagePrice: breakdown.overagePrice,
      totalPrice: breakdown.totalPrice,
      currency: planPrice.currency,
      payrollFeePercentage: planPrice.config.payrollFeePercentage ?? 3,
      breakdown,
    };
  }
  async upsertPlanWithPrice(params: {
    slug: string;
    name: string;
    description?: string;
    countryCode: string;
    currency: string;
    monthlyPrice: number;
    yearlyPrice?: number;
    regionalConfig: PlanRegionalConfig;
    features?: Record<string, boolean>;
    limits?: Record<string, number>;
    sortOrder?: number;
  }): Promise<PlanPrice> {
    let plan = await this.findPlanBySlug(params.slug);
    if (!plan) {
      plan = await this.createPlan({
        slug: params.slug,
        name: params.name,
        description: params.description ?? null,
        features: params.features ?? {},
        limits: params.limits ?? {},
        sortOrder: params.sortOrder ?? 0,
        isActive: true,
      });
    }
    const existing = await this.planPriceRepository.findOne({
      where: {
        planId: plan.id,
        countryCode: params.countryCode,
        currency: params.currency,
      },
    });
    if (existing) {
      return this.updatePlanPrice(existing.id, {
        monthlyPrice: params.monthlyPrice,
        yearlyPrice: params.yearlyPrice ?? params.monthlyPrice * 10,
        regionalConfig: params.regionalConfig,
        isActive: true,
      });
    }
    return this.createPlanPrice({
      planId: plan.id,
      countryCode: params.countryCode,
      currency: params.currency,
      monthlyPrice: params.monthlyPrice,
      yearlyPrice: params.yearlyPrice ?? params.monthlyPrice * 10,
      regionalConfig: params.regionalConfig,
      isActive: true,
    });
  }
}
