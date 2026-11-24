import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthOnly } from 'src/common/decorators';
import { UserRole } from 'src/common/enums';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';

import type { PlanPrice } from '../entities/plan-price.entity';
import { UpdatePlanPriceDto } from '../dto/update-plan-price.dto';
import { UpsertPlanPriceDto } from '../dto/upsert-plan-price.dto';
import { PlansService } from '../services/plans.service';

@ApiTags('Plans Admin')
@Controller('admin/plans')
@AuthOnly()
@UseGuards(RoleGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
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
  async updatePlanPrice(@Param('id') id: string, @Body() updates: UpdatePlanPriceDto) {
    return this.plansService.updatePlanPrice(id, updates);
  }
}
