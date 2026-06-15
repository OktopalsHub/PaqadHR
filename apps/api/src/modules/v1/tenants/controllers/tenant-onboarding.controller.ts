import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from 'src/common/decorators';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { IAuthenticatedUserRequest } from 'src/common/interfaces';
import { TenantOnboardingService } from '../services/tenant-onboarding.service';
import { OnboardingData } from "../../../../common/interfaces/onboarding-data.interface";
import { CompleteOnboardingDto } from '../dto/complete-onboarding.dto';

@ApiTags('Tenant Onboarding')
@Controller('onboarding')
export class TenantOnboardingController {
  constructor(private readonly onboardingService: TenantOnboardingService) {}
  @Get('pricing-preview')
  @Public()
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
    @Req() req: IAuthenticatedUserRequest,
    @Query('country') countryCode?: string,
  ) {
    const clientIp = this.getClientIP(req);
    return this.onboardingService.getPricingPreview(countryCode, clientIp);
  }

  @Get('slug-availability')
  @Public()
  @ApiOperation({
    summary: 'Check whether a workspace slug is available',
  })
  @ApiQuery({
    name: 'slug',
    required: true,
    description: 'Desired workspace slug',
  })
  async checkSlugAvailability(@Query('slug') slug: string) {
    return this.onboardingService.checkSlugAvailability(slug ?? '');
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
    @Body() dto: CompleteOnboardingDto,
    @CurrentUser() req: IAuthenticatedUserRequest,
    @Req() httpReq: IAuthenticatedUserRequest,
  ) {
    const clientIp = this.getClientIP(httpReq);
    const onboardingData: OnboardingData = {
      name: dto.name,
      slug: dto.slug,
      industry: dto.industry,
      companySize: dto.companySize,
      firstName: dto.firstName,
      lastName: dto.lastName,
      preferredName: dto.preferredName,
      jobTitle: dto.jobTitle,
      planSlug: dto.planSlug,
      createdBy: req.auth.principalId,
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
  private getClientIP(req: IAuthenticatedUserRequest): string {
    return GeoLocationHelper.resolveClientIp(
      req.headers,
      req.socket?.remoteAddress,
      req.ip,
    );
  }
}
