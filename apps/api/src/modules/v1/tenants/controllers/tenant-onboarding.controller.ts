import { Tenant } from '../entities/tenant.entity';
import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { TenantOnboardingService } from '../services/tenant-onboarding.service';
import { AuthenticatedRequest } from "../../../../common/interfaces/authenticated-request.interface";
import { OnboardingData } from "../../../../common/interfaces/onboarding-data.interface";

export class CreateTenantDto {
  name: string;
  industry?: string;
  companySize?: string;
  businessCountry?: string; 
}
@ApiTags('Tenant Onboarding')
@Controller('onboarding')
export class TenantOnboardingController {
  constructor(private readonly onboardingService: TenantOnboardingService) {}
  @Get('pricing-preview')
  @ApiOperation({
    summary: 'Preview pricing for user location (before signup)',
    description:
      'Shows pricing based on IP detection or selected country. No registration required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pricing preview retrieved successfully',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Override country code (e.g., NG, US)',
  })
  async getPricingPreview(
    @Req() req: AuthenticatedRequest,
    @Query('country') countryCode?: string,
  ) {
    const clientIp = this.getClientIP(req);
    return this.onboardingService.getPricingPreview(countryCode, clientIp);
  }
  @Post('complete')
  @ApiOperation({
    summary: 'Complete tenant onboarding with automatic pricing lock',
    description:
      'Creates tenant and permanently locks pricing based on business location or IP detection.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tenant onboarded successfully with locked pricing',
  })
  async completeTenantOnboarding(
    @Body() dto: CreateTenantDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const clientIp = this.getClientIP(req);
    const userId = req.user?.id;
    const onboardingData: OnboardingData = {
      name: dto.name,
      industry: dto.industry,
      companySize: dto.companySize,
      businessCountry: dto.businessCountry,
      createdBy: userId || undefined,
    };
    return this.onboardingService.completeTenantOnboarding(
      onboardingData,
      clientIp,
    );
  }
  @Get('tenant/:tenantId/pricing-info')
  @ApiOperation({
    summary: 'Get tenant pricing lock information',
    description: 'Shows current pricing region and whether it can be changed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pricing information retrieved successfully',
  })
  async getTenantPricingInfo(@Param('tenantId') tenantId: string) {
    return this.onboardingService.getTenantPricingInfo(tenantId);
  }
  @Get('tenant/:tenantId/can-change-region')
  @ApiOperation({
    summary: 'Check if tenant can change pricing region',
    description: 'Returns whether pricing region can still be modified.',
  })
  @ApiResponse({
    status: 200,
    description: 'Region change eligibility checked',
  })
  async canChangePricingRegion(@Param('tenantId') tenantId: string) {
    return this.onboardingService.canChangePricingRegion(tenantId);
  }
  private getClientIP(req: AuthenticatedRequest): string {
    return GeoLocationHelper.resolveClientIp(
      req.headers,
      req.socket?.remoteAddress,
      req.ip,
    );
  }
}
