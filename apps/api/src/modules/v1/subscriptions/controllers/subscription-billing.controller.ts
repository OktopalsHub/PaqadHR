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
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { CreateSubscriptionCheckoutDto } from '../dto/create-subscription-checkout.dto';
import { BillingGatewayGuard } from '../guards/billing-gateway.guard';
import { SubscriptionBillingService } from '../services/subscription-billing.service';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionBillingController {
  constructor(private readonly subscriptionBillingService: SubscriptionBillingService) {}

  @Get('tenant/:tenantId/billing-overview')
  @UseGuards(TenantMemberGuard, TenantRoleGuard)
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

    return this.subscriptionBillingService.createSubscriptionCheckout(
      tenantId,
      dto.planSlug,
      userId,
      dto.successUrl,
    );
  }
}
