import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PlanRegionalConfig } from '../../../../common/interfaces/plan-regional-config.interface';
import type { PlanPrice } from '../entities/plan-price.entity';
import { PlansService } from '../services/plans.service';

class UpsertPlanPriceDto {
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
}
@ApiTags('Plans Admin')
@Controller('admin/plans')
export class PlansAdminController {
  constructor(private readonly plansService: PlansService) {}
  @Get()
  @ApiOperation({ summary: 'List all plans' })
  async listPlans() {
    return this.plansService.findAllPlans();
  }
  @Get('prices')
  @ApiOperation({ summary: 'List plan prices by country' })
  async listPrices(@Query('countryCode') countryCode?: string) {
    if (!countryCode) {
      return this.plansService.findAllPlans();
    }
    return this.plansService.getPricesForCountry(countryCode.toUpperCase());
  }
  @Post('prices')
  @ApiOperation({ summary: 'Create or update a plan price for a region' })
  async upsertPlanPrice(@Body() dto: UpsertPlanPriceDto): Promise<PlanPrice> {
    return this.plansService.upsertPlanWithPrice({
      ...dto,
      countryCode: dto.countryCode.toUpperCase(),
      currency: dto.currency.toUpperCase(),
    });
  }
  @Put('prices/:id')
  @ApiOperation({ summary: 'Update plan price' })
  async updatePlanPrice(@Param('id') id: string, @Body() updates: Partial<PlanPrice>) {
    return this.plansService.updatePlanPrice(id, updates);
  }
}
