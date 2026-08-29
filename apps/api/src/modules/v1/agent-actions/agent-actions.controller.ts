import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit, RateLimitPresets } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { IAuthenticatedMemberRequest } from 'src/common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { ExecuteAgentActionDto } from './dto/execute-agent-action.dto';
import { PendingAgentActionListItemDto } from './dto/pending-agent-action-list-item.dto';
import { RejectAgentActionDto } from './dto/reject-agent-action.dto';
import { AgentActionsService } from './services/agent-actions.service';

@ApiTags('Agent Actions')
@ApiBearerAuth('JWT-auth')
@Controller('tenants/:tenantId/agent')
@UseGuards(TenantMemberGuard)
export class AgentActionsController {
  constructor(private readonly agentActionsService: AgentActionsService) {}

  @Post('actions')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @ApiOperation({ summary: 'Execute a semantic agent action' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  executeAction(
    @Param('tenantId') tenantId: string,
    @Body() dto: ExecuteAgentActionDto,
    @Req() request: IAuthenticatedMemberRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.agentActionsService.execute(tenantId, dto, request, idempotencyKey);
  }

  @Get('approvals/pending')
  @ApiOperation({ summary: 'List pending agent actions awaiting approval' })
  @ApiOkResponse({ type: PendingAgentActionListItemDto, isArray: true })
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  listPending(@Param('tenantId') tenantId: string) {
    return this.agentActionsService.listPendingApprovals(tenantId);
  }

  @Post('approvals/:actionId/approve')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @ApiOperation({ summary: 'Approve and execute a pending agent action' })
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  approve(
    @Param('tenantId') tenantId: string,
    @Param('actionId') actionId: string,
    @Req() request: IAuthenticatedMemberRequest,
  ) {
    return this.agentActionsService.approvePendingAction(tenantId, actionId, request.member.id);
  }

  @Post('approvals/:actionId/reject')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @ApiOperation({ summary: 'Reject a pending agent action' })
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  reject(
    @Param('tenantId') tenantId: string,
    @Param('actionId') actionId: string,
    @Req() request: IAuthenticatedMemberRequest,
    @Body() dto: RejectAgentActionDto,
  ) {
    return this.agentActionsService.rejectPendingAction(
      tenantId,
      actionId,
      request.member.id,
      dto.reason,
    );
  }
}
