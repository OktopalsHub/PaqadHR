import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { IAuthenticatedMemberRequest } from 'src/common/interfaces';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { CancelSubscriptionDto } from '../dto/cancel-subscription.dto';
import { CreateSubscriptionCheckoutDto } from '../dto/create-subscription-checkout.dto';
import { UpdatePaymentMethodDto } from '../dto/update-payment-method.dto';
import { BillingGatewayGuard } from '../guards/billing-gateway.guard';
import { SubscriptionBillingService } from '../services/subscription-billing.service';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionBillingController {
  constructor(private readonly subscriptionBillingService: SubscriptionBillingService) {}

  @Get('tenant/:tenantId/billing-overview')
  @UseGuards(TenantMemberGuard, TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN, TenantMemberRole.MEMBER)
  @ApiOperation({ summary: 'Server-side billing overview with per-seat plan quotes' })
  getBillingOverview(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const role = req.member?.role;
    const canManageBilling = role === TenantMemberRole.OWNER || role === TenantMemberRole.ADMIN;
    return this.subscriptionBillingService.getBillingOverview(tenantId, canManageBilling);
  }

  @Post('tenant/:tenantId/checkout')
  @UseGuards(TenantMemberGuard, TenantRoleGuard, BillingGatewayGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'Start Nomba checkout (server resolves price and seat count)' })
  createCheckout(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateSubscriptionCheckoutDto,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const userId = req.auth?.principalId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const clientIp = GeoLocationHelper.resolveClientIp(
      req.headers,
      req.socket?.remoteAddress,
      req.ip,
    );

    return this.subscriptionBillingService.createSubscriptionCheckout(
      tenantId,
      dto.planSlug,
      userId,
      dto.successUrl,
      clientIp,
    );
  }

  @Post('tenant/:tenantId/update-payment-method')
  @UseGuards(TenantMemberGuard, TenantRoleGuard, BillingGatewayGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'Start Nomba checkout to update saved card' })
  updatePaymentMethod(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: UpdatePaymentMethodDto,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const userId = req.auth?.principalId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.subscriptionBillingService.createPaymentMethodUpdateCheckout(
      tenantId,
      userId,
      dto.successUrl,
    );
  }

  @Post('tenant/:tenantId/cancel')
  @UseGuards(TenantMemberGuard, TenantRoleGuard, BillingGatewayGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'Cancel subscription (default: at period end)' })
  cancelSubscription(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.subscriptionBillingService.cancelSubscription(tenantId, dto);
  }

  @Post('tenant/:tenantId/pause')
  @UseGuards(TenantMemberGuard, TenantRoleGuard, BillingGatewayGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'Pause subscription renewals until period end' })
  pauseSubscription(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.subscriptionBillingService.pauseSubscription(tenantId);
  }

  @Post('tenant/:tenantId/resume')
  @UseGuards(TenantMemberGuard, TenantRoleGuard, BillingGatewayGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'Resume paused subscription or undo scheduled cancel' })
  resumeSubscription(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.subscriptionBillingService.resumeSubscription(tenantId);
  }
}
