import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import type { PaginationDto } from 'src/common/dto/pagination.dto';
import { LeaveStatus } from 'src/common/enums';
import type { MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { isTenantAdmin } from 'src/common/utils/member-access.util';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import type { CreateLeaveDto } from './dto/create-leave.dto';
import type { LeaveResponseDto } from './dto/leave-response.dto';
import type { UpdateLeaveDto } from './dto/update-leave.dto';
import { LeaveService } from './leave.service';

@ApiTags('Leaves')
@Controller('tenants/:tenantId/leaves')
@UseGuards(TenantMemberGuard)
export class LeaveController {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  private async assertLeaveRead(
    member: MemberContext,
    leave: LeaveResponseDto,
    tenantId: string,
  ): Promise<void> {
    const isRequester = leave.requester?.id === member.id;
    if (isTenantAdmin(member) || isRequester) {
      return;
    }
    if (leave.requester?.id) {
      const isManager = await this.managerAccessService.isManagerOf(
        tenantId,
        member.id,
        leave.requester.id,
      );
      if (isManager) {
        return;
      }
    }
    throw new ForbiddenException('You can only view your own leave requests');
  }

  private assertLeaveMutation(member: MemberContext, leave: LeaveResponseDto): void {
    const isRequester = leave.requester?.id === member.id;
    const isPending = leave.status === LeaveStatus.PENDING;
    if (!isTenantAdmin(member) && !(isRequester && isPending)) {
      throw new ForbiddenException('You can only modify your own pending leave requests');
    }
  }

  @Post()
  async createLeave(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateLeaveDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.leaveService.createLeave(tenantId, member.id, dto);
  }

  @Get()
  async listLeavesByTenant(
    @Param('tenantId') tenantId: string,
    @Query() pagination: PaginationDto,
    @CurrentTenantMember() member: MemberContext,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters = { status, from, to };
    if (isTenantAdmin(member)) {
      return this.leaveService.listLeavesByTenant(tenantId, pagination, filters);
    }
    const directReports = await this.managerAccessService.getDirectReportIds(tenantId, member.id);
    if (directReports.length === 0) {
      throw new ForbiddenException('Admin or manager access required');
    }
    return this.leaveService.listLeavesByTenant(tenantId, pagination, {
      ...filters,
      requesterIds: directReports,
    });
  }

  @Get('me')
  async getMyLeaves(
    @Param('tenantId') tenantId: string,
    @Query() pagination: PaginationDto,
    @CurrentTenantMember() member: MemberContext,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.leaveService.getLeavesByMember(tenantId, member.id, pagination, {
      status,
      from,
      to,
    });
  }

  @Get('balances')
  async getMyLeaveBalances(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
    @Query('year') year?: number,
  ) {
    return this.leaveService.getLeaveBalanceForMember(tenantId, member.id, year);
  }

  @Get('balances/:leaveTypeId')
  async getMyLeaveBalanceByType(
    @Param('tenantId') tenantId: string,
    @Param('leaveTypeId') leaveTypeId: string,
    @CurrentTenantMember() member: MemberContext,
    @Query('year') year?: number,
  ) {
    return this.leaveService.getLeaveBalanceForMemberByType(tenantId, member.id, leaveTypeId, year);
  }

  @Get(':leaveId')
  async getLeave(
    @Param('tenantId') tenantId: string,
    @Param('leaveId') leaveId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const leave = await this.leaveService.getLeave(tenantId, leaveId);
    await this.assertLeaveRead(member, leave, tenantId);
    return leave;
  }

  @Patch(':leaveId')
  async updateLeave(
    @Param('tenantId') tenantId: string,
    @Param('leaveId') leaveId: string,
    @Body() dto: UpdateLeaveDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const leave = await this.leaveService.getLeave(tenantId, leaveId);
    this.assertLeaveMutation(member, leave);
    return this.leaveService.updateLeave(tenantId, leaveId, dto);
  }

  @Delete(':leaveId')
  async deleteLeave(
    @Param('tenantId') tenantId: string,
    @Param('leaveId') leaveId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const leave = await this.leaveService.getLeave(tenantId, leaveId);
    this.assertLeaveMutation(member, leave);
    return this.leaveService.deleteLeave(tenantId, leaveId);
  }

  @Patch(':leaveId/approve')
  async approveLeave(
    @Param('tenantId') tenantId: string,
    @Param('leaveId') leaveId: string,
    @Body('comments') comments: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const leave = await this.leaveService.getLeave(tenantId, leaveId);
    if (leave.requester?.id === member.id) {
      throw new ForbiddenException('You cannot approve your own leave request');
    }
    if (leave.requester?.id) {
      await this.managerAccessService.assertAdminOrManagerOf(member, leave.requester.id, tenantId);
    } else {
      throw new ForbiddenException('Admin or manager access required');
    }
    return this.leaveService.approveLeave(tenantId, leaveId, member.id, comments);
  }

  @Patch(':leaveId/reject')
  async rejectLeave(
    @Param('tenantId') tenantId: string,
    @Param('leaveId') leaveId: string,
    @Body('comments') comments: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const leave = await this.leaveService.getLeave(tenantId, leaveId);
    if (leave.requester?.id === member.id) {
      throw new ForbiddenException('You cannot reject your own leave request');
    }
    if (leave.requester?.id) {
      await this.managerAccessService.assertAdminOrManagerOf(member, leave.requester.id, tenantId);
    } else {
      throw new ForbiddenException('Admin or manager access required');
    }
    return this.leaveService.rejectLeave(tenantId, leaveId, member.id, comments);
  }
}
