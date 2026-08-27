import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RateLimit, RateLimitPresets } from 'src/common/decorators';
import type { MemberContext } from 'src/common/interfaces';
import { assertSelfOrAdmin } from 'src/common/utils/member-access.util';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import {
  ChangePaymentPasscodeDto,
  SetPasscodeDto,
  VerifyPasscodeDto,
} from '../dto/paymemt-security.dto';
import { PaymentSecurityService } from '../services/payment-security.service';

@ApiTags('Payment Security')
@Controller('tenants/:tenantId/payment-security')
@UseGuards(TenantMemberGuard)
export class PaymentSecurityController {
  constructor(private readonly paymentSecurityService: PaymentSecurityService) {}

  @Get(':memberId/status')
  async getStatus(
    @Param('tenantId') tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    assertSelfOrAdmin(member, memberId);
    const hasPasscode = await this.paymentSecurityService.hasPasscode(memberId, tenantId);
    return { hasPasscode };
  }

  @Post(':memberId/set-passcode')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async setPasscode(
    @Param('tenantId') tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: SetPasscodeDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    assertSelfOrAdmin(member, memberId);
    return this.paymentSecurityService.setPasscode(memberId, tenantId, dto.passcode);
  }

  @Post(':memberId/change-passcode')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async changePasscode(
    @Param('tenantId') tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: ChangePaymentPasscodeDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    assertSelfOrAdmin(member, memberId);
    await this.paymentSecurityService.changePasscode(
      memberId,
      tenantId,
      dto.currentPasscode,
      dto.newPasscode,
    );
    return { changed: true };
  }

  @Post(':memberId/verify-passcode')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async verifyPasscode(
    @Param('tenantId') tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: VerifyPasscodeDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    assertSelfOrAdmin(member, memberId);
    const verified = await this.paymentSecurityService.verifyPasscode(
      memberId,
      tenantId,
      dto.passcode,
    );
    return { verified };
  }
}
