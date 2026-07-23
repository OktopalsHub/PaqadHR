import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import type { MemberContext } from 'src/common/interfaces';
import { assertSelfOrAdmin } from 'src/common/utils/member-access.util';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { SetPasscodeDto, VerifyPasscodeDto } from '../dto/paymemt-security.dto';
import { PaymentSecurityService } from '../services/payment-security.service';

@ApiTags('Payment Security')
@Controller('tenants/:tenantId/payment-security')
@UseGuards(TenantMemberGuard)
export class PaymentSecurityController {
  constructor(private readonly paymentSecurityService: PaymentSecurityService) {}

  @Post(':memberId/set-passcode')
  async setPasscode(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: SetPasscodeDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    assertSelfOrAdmin(member, memberId);
    return this.paymentSecurityService.setPasscode(memberId, dto.passcode);
  }

  @Post(':memberId/verify-passcode')
  async verifyPasscode(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: VerifyPasscodeDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    assertSelfOrAdmin(member, memberId);
    const verified = await this.paymentSecurityService.verifyPasscode(memberId, dto.passcode);
    return { verified };
  }
}
