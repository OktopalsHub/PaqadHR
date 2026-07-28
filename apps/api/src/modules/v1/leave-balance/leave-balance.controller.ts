import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotImplementedException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { isTenantAdmin } from 'src/common/utils/member-access.util';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { CreateLeaveBalanceDto } from './dto/create-leave-balance.dto';
import { UpdateLeaveBalanceDto } from './dto/update-leave-balance.dto';
import { LeaveBalanceService } from './leave-balance.service';

@ApiTags('Leave Balances')
@Controller('tenants/:tenantId/leave-balances')
@UseGuards(TenantMemberGuard)
@RequireFeatures(FeatureAccess.LEAVE_MANAGEMENT)
export class LeaveBalanceController {
  constructor(
    private readonly leaveBalanceService: LeaveBalanceService,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  @Post()
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async createLeaveBalance(
    @Param('tenantId') tenantId: string,
    @Param('leaveTypeId') leaveTypeId: string,
    @Body() dto: CreateLeaveBalanceDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.leaveBalanceService.createLeaveBalance(tenantId, member.id, leaveTypeId, dto);
  }

  @Get()
  async listLeaveBalances(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    if (isTenantAdmin(member)) {
      return this.leaveBalanceService.listLeaveBalances(tenantId);
    }
    const directReports = await this.managerAccessService.getDirectReportIds(tenantId, member.id);
    if (directReports.length === 0) {
      throw new ForbiddenException('Admin or manager access required');
    }
    return this.leaveBalanceService.listLeaveBalances(tenantId, directReports);
  }

  @Get('member/:memberId')
  async getMemberBalances(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
    @CurrentTenantMember() member: MemberContext,
    @Query('year') year?: number,
  ) {
    await this.managerAccessService.assertAdminOrSelfOrManagerOf(member, memberId, tenantId);
    const currentYear = year || new Date().getFullYear();
    return this.leaveBalanceService.getBalancesByMember(tenantId, memberId, currentYear);
  }

  @Post('assign')
  assignLeaveBalance() {
    throw new NotImplementedException('Leave balance assignment is not available yet');
  }

  @Post('assign/bulk')
  bulkAssignLeaveBalances() {
    throw new NotImplementedException('Bulk leave balance assignment is not available yet');
  }

  @Post('initialize/:memberId')
  initializeMemberBalances() {
    throw new NotImplementedException('Leave balance initialization is not available yet');
  }

  @Get(':balanceId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getLeaveBalance(
    @Param('tenantId') tenantId: string,
    @Param('balanceId') balanceId: string,
  ) {
    return this.leaveBalanceService.getLeaveBalance(balanceId, tenantId);
  }

  @Patch(':balanceId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async updateLeaveBalance(
    @Param('tenantId') tenantId: string,
    @Param('balanceId') balanceId: string,
    @Body() dto: UpdateLeaveBalanceDto,
  ) {
    return this.leaveBalanceService.updateLeaveBalance(balanceId, dto, tenantId);
  }

  @Delete(':balanceId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async deleteLeaveBalance(
    @Param('tenantId') tenantId: string,
    @Param('balanceId') balanceId: string,
  ) {
    return this.leaveBalanceService.deleteLeaveBalance(tenantId, balanceId);
  }
}
