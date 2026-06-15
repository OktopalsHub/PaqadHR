import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentTenantMember } from 'src/common/decorators';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { PositionMemberService } from '../services/position-member.service';
@Controller('tenants/:tenantId/positions')
@UseGuards(TenantMemberGuard)
export class PositionMemberController {
  constructor(private readonly positionMemberService: PositionMemberService) {}
  @Get('member/:memberId/history')
  async getPositionHistory(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.positionMemberService.getPositionHistory(tenantId, member.id);
  }
  @Get('position/:positionId/members')
  async getMembersByPosition(
    @Param('tenantId') tenantId: string,
    @Param('positionId') positionId: string,
  ) {
    return this.positionMemberService.getMembersByPosition(tenantId, positionId);
  }
  @Post('assign')
  async assignPosition(
    @Param('tenantId') tenantId: string,
    @Param('positionId') positionId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.positionMemberService.assignPosition(tenantId, member.id, positionId);
  }
}
