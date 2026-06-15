import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthOnly } from 'src/common/decorators';
import { UserRole } from 'src/common/enums';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import type { ActivateSubscriptionDto } from '../dto/activate-subscription.dto';
import type { ExtendTrialDto } from '../dto/extend-trial.dto';
import { SubscriptionsService } from '../services/subscriptions.service';

@ApiTags('Subscriptions Admin')
@Controller('admin/subscriptions')
@AuthOnly()
@UseGuards(RoleGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class SubscriptionsAdminController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('tenant/:tenantId/activate')
  @ApiOperation({
    summary: 'Manually activate a tenant subscription (no card charge)',
  })
  activateTenant(@Param('tenantId') tenantId: string, @Body() dto: ActivateSubscriptionDto) {
    return this.subscriptionsService.activateTenantSubscription(tenantId, dto);
  }

  @Post('tenant/:tenantId/extend-trial')
  @ApiOperation({ summary: 'Extend tenant trial period' })
  extendTrial(@Param('tenantId') tenantId: string, @Body() dto: ExtendTrialDto) {
    return this.subscriptionsService.extendTrial(tenantId, dto.additionalDays);
  }
}
