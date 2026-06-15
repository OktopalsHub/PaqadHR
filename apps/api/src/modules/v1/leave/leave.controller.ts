import {
  Body,
  Controller,
  Delete,
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
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import type { CreateLeaveDto } from './dto/create-leave.dto';
import type { UpdateLeaveDto } from './dto/update-leave.dto';
import type { LeaveService } from './leave.service';

@ApiTags('Leaves')
@Controller('tenants/:tenantId/leaves')
@UseGuards(TenantMemberGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}
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
  ) {
    return this.leaveService.listLeavesByTenant(tenantId, pagination);
  }
  @Get('me')
  async getMyLeaves(
    @Param('tenantId') tenantId: string,
    @Query() pagination: PaginationDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.leaveService.getLeavesByMember(tenantId, member.id, pagination);
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
  async getLeave(@Param('tenantId') tenantId: string, @Param('leaveId') leaveId: string) {
    return this.leaveService.getLeave(tenantId, leaveId);
  }
  @Patch(':leaveId')
  async updateLeave(
    @Param('tenantId') tenantId: string,
    @Param('leaveId') leaveId: string,
    @Body() dto: UpdateLeaveDto,
  ) {
    return this.leaveService.updateLeave(tenantId, leaveId, dto);
  }
  @Delete(':leaveId')
  async deleteLeave(@Param('tenantId') tenantId: string, @Param('leaveId') leaveId: string) {
    return this.leaveService.deleteLeave(tenantId, leaveId);
  }
  @Patch(':leaveId/approve')
  async approveLeave(
    @Param('tenantId') tenantId: string,
    @Param('leaveId') leaveId: string,
    @Body('comments') comments: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.leaveService.approveLeave(tenantId, leaveId, member.id, comments);
  }
  @Patch(':leaveId/reject')
  async rejectLeave(
    @Param('tenantId') tenantId: string,
    @Param('leaveId') leaveId: string,
    @Body('comments') comments: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.leaveService.rejectLeave(tenantId, leaveId, member.id, comments);
  }
}
