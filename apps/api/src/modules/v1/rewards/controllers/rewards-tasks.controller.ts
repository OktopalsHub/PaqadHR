import { Body, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentTenantMember } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { MemberPointsService } from '../../shoutouts/services/member-points.service';
import { AssignMemberPointsDto } from '../dto/assign-member-points.dto';
import { RewardsService } from '../services/rewards.service';

const ALL_ROLES = [
  TenantMemberRole.OWNER,
  TenantMemberRole.ADMIN,
  TenantMemberRole.MEMBER,
] as const;
const ADMIN_ROLES = [TenantMemberRole.OWNER, TenantMemberRole.ADMIN] as const;

export class RewardsTasksHandler {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly memberPointsService: MemberPointsService,
  ) {}

  @Get('tasks')
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async listTasks(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.listTasks(tenantId, member.id);
  }

  @Get('tasks/submissions/pending')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async listPendingSubmissions(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.listPendingSubmissions(tenantId, member.id);
  }

  @Post('tasks')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async createTask(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      title: string;
      description: string;
      points: number;
      icon: string;
      category?: string;
      imageUrl?: string;
      submissionType: 'instant' | 'text' | 'file';
      isRecurring?: boolean;
    },
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.createTask(tenantId, body, member.id);
  }

  @Patch('tasks/:taskId')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async updateTask(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      points?: number;
      icon?: string;
      category?: string;
      imageUrl?: string;
      submissionType?: 'instant' | 'text' | 'file';
      isRecurring?: boolean;
    },
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.updateTask(tenantId, taskId, body, member.id);
  }

  @Delete('tasks/:taskId')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async deleteTask(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.deleteTask(tenantId, taskId, member.id);
  }

  @Post('tasks/:taskId/submit')
  @UseGuards(TenantRoleGuard)
  @Roles(...ALL_ROLES)
  async submitTask(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @CurrentTenantMember() member: MemberContext,
    @Body() body: { submissionText?: string; submissionFileName?: string },
  ) {
    return this.rewardsService.submitTask(tenantId, taskId, member.id, body);
  }

  @Post('tasks/:taskId/submissions/:submissionId/approve')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async approveSubmission(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Param('submissionId') submissionId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.approveSubmission(tenantId, taskId, submissionId, member.id);
  }

  @Post('tasks/:taskId/submissions/:submissionId/reject')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async rejectSubmission(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Param('submissionId') submissionId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.rewardsService.rejectSubmission(tenantId, taskId, submissionId, member.id);
  }

  @Post('assign-points')
  @UseGuards(TenantRoleGuard)
  @Roles(...ADMIN_ROLES)
  async assignPoints(
    @Param('tenantId') tenantId: string,
    @Body() body: AssignMemberPointsDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.memberPointsService.assignPoints(
      tenantId,
      body.memberIds ?? [],
      body.points ?? 0,
      body.reason,
      member.id,
      body.assignments,
    );
  }
}
