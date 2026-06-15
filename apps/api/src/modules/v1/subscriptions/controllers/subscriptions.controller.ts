import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import type { SubscriptionsService } from '../services/subscriptions.service';

class SetTenantRegionDto {
  countryCode: string;
  timezone?: string;
  preferredCurrency?: string;
}
class OnboardingRegionDto {
  userSelectedCountry?: string;
}
@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}
  @Get('countries')
  @ApiOperation({ summary: 'Supported billing countries' })
  getSupportedCountries() {
    return this.subscriptionsService.getSupportedCountries();
  }
  @Post('tenant/:tenantId/set-region')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Lock tenant billing country (once)' })
  setTenantRegion(@Param('tenantId') tenantId: string, @Body() dto: SetTenantRegionDto) {
    return this.subscriptionsService.setTenantRegion(tenantId, dto);
  }
  @Post('tenant/:tenantId/onboarding-region')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Set tenant region during onboarding' })
  setOnboardingRegion(
    @Param('tenantId') tenantId: string,
    @Body() dto: OnboardingRegionDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.setTenantRegionOnboarding(
      tenantId,
      this.getClientIP(req),
      dto.userSelectedCountry,
    );
  }
  @Get('tenant/:tenantId')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Get tenant subscription' })
  getTenantSubscription(@Param('tenantId') tenantId: string) {
    return this.subscriptionsService.getTenantSubscription(tenantId);
  }

  @Get('tenant/:tenantId/billing-status')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({
    summary: 'Billing mode, trial info, and whether card payments are enabled',
  })
  getBillingStatus(@Param('tenantId') tenantId: string) {
    return this.subscriptionsService.getBillingStatus(tenantId);
  }
  @Get('tenant/:tenantId/pricing')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Get tenant plan prices for locked country' })
  getTenantPricing(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.subscriptionsService.getTenantPricing(tenantId, this.getClientIP(req));
  }
  private getClientIP(req: Request): string {
    return GeoLocationHelper.resolveClientIp(req.headers, req.socket.remoteAddress, req.ip);
  }
}
