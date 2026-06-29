import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenantMember } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import type { AssignPositionDto } from '../dto/assign-position.dto';
import { PositionMemberService } from '../services/position-member.service';

@Controller('tenants/:tenantId/positions')
@UseGuards(TenantMemberGuard)
export class PositionMemberController {
  constructor(
    private readonly positionMemberService: PositionMemberService,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  @Get('member/:memberId/history')
  async getPositionHistory(
    @Param('tenantId') tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    await this.managerAccessService.assertAdminOrSelfOrManagerOf(member, memberId, tenantId);
    return this.positionMemberService.getPositionHistory(tenantId, memberId);
  }

  @Get('position/:positionId/members')
  async getMembersByPosition(
    @Param('tenantId') tenantId: string,
    @Param('positionId', ParseUUIDPipe) positionId: string,
  ) {
    return this.positionMemberService.getMembersByPosition(tenantId, positionId);
  }

  @Post('member/:memberId/assign')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async assignPosition(
    @Param('tenantId') tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: AssignPositionDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.positionMemberService.assignPosition(
      tenantId,
      memberId,
      body.positionId,
      body.assignedAt ?? new Date(),
    );
  }
}
