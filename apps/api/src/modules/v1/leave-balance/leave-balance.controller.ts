import { Leave } from '../leave/entities/leave.entity';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards } from '@nestjs/common';
import { CurrentTenantMember } from 'src/common/decorators';
import { ApiTags } from '@nestjs/swagger';
import { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { LeaveBalanceService } from './leave-balance.service';
import { CreateLeaveBalanceDto } from "./dto/create-leave-balance.dto";
import { UpdateLeaveBalanceDto } from "./dto/update-leave-balance.dto";

@ApiTags('Leave Balances')
@Controller('tenants/:tenantId/leave-balances')
@UseGuards(TenantMemberGuard)
export class LeaveBalanceController {
  constructor(private readonly leaveBalanceService: LeaveBalanceService) {}
  @Post()
    async createLeaveBalance(
    @Param('tenantId') tenantId: string,
    @Param('leaveTypeId') leaveTypeId: string,
    @Body() dto: CreateLeaveBalanceDto,
    @CurrentTenantMember() member: MemberContext
  ) {
    return this.leaveBalanceService.createLeaveBalance(
      tenantId,
      member.id,
      leaveTypeId,
      dto,
    );
  }
  @Get()
  async listLeaveBalances(@Param('tenantId') tenantId: string) {
    return this.leaveBalanceService.listLeaveBalances(tenantId);
  }
  @Get(':balanceId')
  async getLeaveBalance(
    @Param('tenantId') tenantId: string,
    @Param('balanceId') balanceId: string,
  ) {
    return this.leaveBalanceService.getLeaveBalance(balanceId, tenantId);
  }
  @Patch(':balanceId')
    async updateLeaveBalance(
    @Param('tenantId') tenantId: string,
    @Param('balanceId') balanceId: string,
    @Body() dto: UpdateLeaveBalanceDto,
  ) {
    return this.leaveBalanceService.updateLeaveBalance(
      balanceId,
      dto,
      tenantId,
    );
  }
  @Delete(':balanceId')
    async deleteLeaveBalance(
    @Param('tenantId') tenantId: string,
    @Param('balanceId') balanceId: string,
  ) {
    return this.leaveBalanceService.deleteLeaveBalance(tenantId, balanceId);
  }
  @Post('assign')
    async assignLeaveBalance(
    @Param('tenantId') tenantId: string,
    @Body()
    dto: {
      memberId: string;
      leaveTypeId: string;
      totalDays: number;
      year: number;
    },
  ) {
  }
  @Post('assign/bulk')
    async bulkAssignLeaveBalances(
    @Param('tenantId') tenantId: string,
    @Body()
    assignments: Array<{
      memberId: string;
      leaveTypeId: string;
      totalDays: number;
      year: number;
    }>,
  ) {
  }
  @Post('initialize/:memberId')
    async initializeMemberBalances(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
    @Query('year') year?: number,
  ) {
  }
  @Get('member/:memberId')
  async getMemberBalances(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
    @Query('year') year?: number,
  ) {
    const currentYear = year || new Date().getFullYear();
    return this.leaveBalanceService.getBalancesByMember(
      tenantId,
      memberId,
      currentYear,
    );
  }
}
