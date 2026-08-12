import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { StartTrialDto } from '../dto/start-trial.dto';
import { SubscriptionsService } from '../services/subscriptions.service';

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

  @Get('landing-pricing')
  @Public()
  @ApiOperation({ summary: 'Landing page pricing currency from visitor IP' })
  async getLandingPricing(@Req() req: Request) {
    const ip = this.getClientIP(req);
    const countryCode = await GeoLocationHelper.getCountryCode(ip);
    const currency = countryCode === 'NG' ? 'NGN' : 'USD';
    return { countryCode, currency };
  }

  @Post('tenant/:tenantId/start-trial')
  @UseGuards(TenantMemberGuard, TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'Start or update a 14-day workspace trial on the selected plan' })
  startTrial(@Param('tenantId') tenantId: string, @Body() dto: StartTrialDto, @Req() req: Request) {
    const clientIp = GeoLocationHelper.resolveClientIp(
      req.headers,
      req.socket.remoteAddress,
      req.ip,
    );
    return this.subscriptionsService.startTrial(tenantId, dto.planSlug, clientIp);
  }
  @Post('tenant/:tenantId/set-region')
  @UseGuards(TenantMemberGuard, TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'Lock tenant billing country (once)' })
  setTenantRegion(@Param('tenantId') tenantId: string, @Body() dto: SetTenantRegionDto) {
    return this.subscriptionsService.setTenantRegion(tenantId, dto);
  }
  @Post('tenant/:tenantId/onboarding-region')
  @UseGuards(TenantMemberGuard, TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
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
      { headers: req.headers },
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
