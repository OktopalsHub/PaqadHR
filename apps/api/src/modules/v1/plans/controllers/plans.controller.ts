import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DetectedCountry } from 'src/common/decorators';
import { PlansService } from '../services/plans.service';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @ApiOperation({ summary: 'List active plans with prices' })
  async listPlans() {
    return this.plansService.findAllPlans();
  }

  @Get('detect')
  @ApiOperation({ summary: 'Detect plans/prices for client country' })
  async detectPlans(@DetectedCountry() country: string) {
    const pricing = await this.plansService.getPricesForCountry(country);
    return { countryCode: country, pricing };
  }

  @Get('country/:countryCode')
  @ApiOperation({ summary: 'Get plan prices for a country' })
  async getPricesForCountry(@Param('countryCode') countryCode: string) {
    return this.plansService.getPricesForCountry(countryCode.toUpperCase());
  }
}
