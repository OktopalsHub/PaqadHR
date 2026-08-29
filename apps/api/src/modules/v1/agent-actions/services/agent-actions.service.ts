import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  AGENT_ACTION_REQUIRED_SCOPES,
  type AgentActionName,
  type AgentActorType,
  type ApiKeyScope,
  HIGH_RISK_AGENT_ACTIONS,
  isAgentActionName,
} from '@paqadhr/contracts';

import { LeaveStatus } from 'src/common/enums';

import { FeatureAccess } from 'src/common/enums/subscription.enum';

import type { IAuthenticatedMemberRequest, MemberContext } from 'src/common/interfaces';

import { getRequestCorrelationId } from 'src/common/observability/correlation-id.storage';

import { formatMemberDisplayName } from 'src/common/utils/member-display.util';

import { ManagerAccessService } from 'src/common/services/manager-access.service';

import { Repository } from 'typeorm';

import { ActivitiesService } from '../../activities/services/activities.service';
import { LeaveService } from '../../leave/leave.service';
import {
  LeaveAuthorizationService,
  toMemberContext,
} from '../../leave/services/leave-authorization.service';

import { PayrollService } from '../../payroll/services/payroll.service';

import { ShoutoutsService } from '../../shoutouts/services/shoutouts.service';

import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';

import { TenantMembersService } from '../../tenant-members/tenant-members.service';

import type { ExecuteAgentActionDto } from '../dto/execute-agent-action.dto';

import { PendingAgentActionListItemDto } from '../dto/pending-agent-action-list-item.dto';

import { AgentActionIdempotency } from '../entities/agent-action-idempotency.entity';

import { PendingAgentAction } from '../entities/pending-agent-action.entity';

export interface AgentActionContext {
  tenantId: string;

  memberId: string;

  member: MemberContext;

  actorType: AgentActorType;

  apiKeyId?: string;

  correlationId?: string;

  idempotencyKey?: string;

  scopes?: ApiKeyScope[];
}

const ACTION_FEATURE_REQUIREMENTS: Partial<Record<AgentActionName, FeatureAccess[]>> = {
  'employees.list': [FeatureAccess.BASIC_HR],

  'leave.balance': [FeatureAccess.LEAVE_MANAGEMENT],

  'leave.request': [FeatureAccess.LEAVE_MANAGEMENT],

  'leave.approve': [FeatureAccess.LEAVE_MANAGEMENT],

  'leave.reject': [FeatureAccess.LEAVE_MANAGEMENT],

  'approvals.pending': [FeatureAccess.LEAVE_MANAGEMENT],

  'shoutout.send': [FeatureAccess.INTEGRATIONS],

  'payroll.run.status': [FeatureAccess.PAYROLL],

  'payroll.run.create': [FeatureAccess.PAYROLL],
};

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

@Injectable()
export class AgentActionsService {
  constructor(
    @InjectRepository(PendingAgentAction)
    private readonly pendingActionRepository: Repository<PendingAgentAction>,

    @InjectRepository(AgentActionIdempotency)
    private readonly idempotencyRepository: Repository<AgentActionIdempotency>,
    private readonly tenantMembersService: TenantMembersService,

    private readonly leaveService: LeaveService,

    private readonly leaveAuthorizationService: LeaveAuthorizationService,

    private readonly managerAccessService: ManagerAccessService,

    private readonly shoutoutsService: ShoutoutsService,

    private readonly payrollService: PayrollService,

    private readonly activitiesService: ActivitiesService,

    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async execute(
    tenantId: string,

    dto: ExecuteAgentActionDto,

    request: IAuthenticatedMemberRequest,

    idempotencyKey?: string,
  ): Promise<Record<string, unknown>> {
    if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new BadRequestException(
        `Idempotency-Key must be at most ${IDEMPOTENCY_KEY_MAX_LENGTH} characters`,
      );
    }

    if (!isAgentActionName(dto.action)) {
      throw new BadRequestException({
        message: `Unknown agent action: ${dto.action}`,

        code: 'AGENT_ACTION_UNKNOWN',
      });
    }

    const action = dto.action as AgentActionName;

    const context = this.buildContext(tenantId, request, idempotencyKey);

    await this.assertActionAuth(context, action);

    if (idempotencyKey) {
      const cached = await this.idempotencyRepository.findOne({
        where: { tenantId, idempotencyKey },
      });

      if (cached) {
        if (cached.action !== action) {
          throw new ConflictException({
            message: 'Idempotency key reused with a different action',

            code: 'IDEMPOTENCY_CONFLICT',
          });
        }

        return { ...cached.response, correlationId: context.correlationId, cached: true };
      }
    }

    if ((HIGH_RISK_AGENT_ACTIONS as readonly string[]).includes(action)) {
      return this.queueForApproval(tenantId, action, dto.params, context);
    }

    const result = await this.dispatch(action, tenantId, dto.params, context);

    await this.recordSuccess(tenantId, action, context, result);

    return { ...result, correlationId: context.correlationId };
  }

  async listPendingApprovals(tenantId: string): Promise<PendingAgentActionListItemDto[]> {
    const rows = await this.pendingActionRepository.find({
      where: { tenantId, status: 'awaiting_approval' },
      order: { createdAt: 'DESC' },
      take: 50,
      relations: { apiKey: true, requestedByMember: true },
      select: {
        id: true,
        action: true,
        status: true,
        createdAt: true,
        correlationId: true,
        actorType: true,
        params: true,
        apiKey: { id: true, name: true },
        requestedByMember: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          preferredName: true,
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      status: row.status,
      createdAt: row.createdAt,
      correlationId: row.correlationId,
      actorType: row.actorType,
      params: row.params,
      apiKeyName: row.apiKey?.name ?? null,
      requestedByMemberName: formatMemberDisplayName(row.requestedByMember),
    }));
  }

  async approvePendingAction(
    tenantId: string,

    actionId: string,

    approverMemberId: string,
  ): Promise<Record<string, unknown>> {
    const pending = await this.pendingActionRepository.findOne({
      where: { id: actionId, tenantId, status: 'awaiting_approval' },
    });

    if (!pending) {
      throw new NotFoundException('Pending action not found');
    }

    if (!isAgentActionName(pending.action)) {
      throw new BadRequestException('Invalid pending action');
    }

    const action = pending.action as AgentActionName;

    const approverMember = await this.tenantMembersService.getTenantMember(
      approverMemberId,
      tenantId,
    );

    const context: AgentActionContext = {
      tenantId,

      memberId: approverMemberId,

      member: toMemberContext(approverMember),

      actorType: pending.actorType as AgentActorType,

      apiKeyId: pending.apiKeyId ?? undefined,

      correlationId: pending.correlationId ?? undefined,

      idempotencyKey: pending.idempotencyKey ?? undefined,
    };

    const result = await this.dispatch(action, tenantId, pending.params, context);

    const updateResult = await this.pendingActionRepository.update(
      { id: actionId, tenantId, status: 'awaiting_approval' },

      {
        status: 'executed',

        approvedByMemberId: approverMemberId,
        result: result as never,
      },
    );

    if (!updateResult.affected) {
      throw new ConflictException('Pending action was already processed');
    }

    await this.recordSuccess(tenantId, action, context, result, approverMemberId);

    return { ...result, correlationId: context.correlationId, pendingActionId: pending.id };
  }

  async rejectPendingAction(
    tenantId: string,

    actionId: string,

    approverMemberId: string,

    reason?: string,
  ): Promise<{ status: string }> {
    const updateResult = await this.pendingActionRepository.update(
      { id: actionId, tenantId, status: 'awaiting_approval' },

      {
        status: 'rejected',

        approvedByMemberId: approverMemberId,

        result: { reason: reason ?? 'Rejected by admin' } as never,
      },
    );

    if (!updateResult.affected) {
      throw new NotFoundException('Pending action not found');
    }

    return { status: 'rejected' };
  }

  private buildContext(
    tenantId: string,

    request: IAuthenticatedMemberRequest,

    idempotencyKey?: string,
  ): AgentActionContext {
    const auth = request.auth;

    if (auth.authType !== 'api_key') {
      throw new ForbiddenException({
        message: 'Agent gateway requires API key authentication',

        code: 'AGENT_API_KEY_REQUIRED',
      });
    }

    if (auth.tenantId && auth.tenantId !== tenantId) {
      throw new ForbiddenException('API key is not valid for this tenant');
    }

    const member = request.member;

    if (!member) {
      throw new ForbiddenException('Tenant membership required');
    }

    return {
      tenantId,

      memberId: member.id,

      member: toMemberContext({ id: member.id, role: member.role }),

      actorType: 'api_key',

      apiKeyId: auth.apiKeyId,

      correlationId: getRequestCorrelationId() ?? undefined,

      idempotencyKey,

      scopes: auth.scopes,
    };
  }

  private async assertActionAuth(
    context: AgentActionContext,

    action: AgentActionName,
  ): Promise<void> {
    const requiredScopes = AGENT_ACTION_REQUIRED_SCOPES[action];

    const scopes = new Set(context.scopes ?? []);

    const missing = requiredScopes.filter((scope) => !scopes.has(scope));

    if (missing.length > 0) {
      throw new ForbiddenException({
        message: 'API key lacks required scopes for this action',

        code: 'API_KEY_SCOPE_DENIED',

        missingScopes: missing,
      });
    }

    const requiredFeatures = ACTION_FEATURE_REQUIREMENTS[action];

    if (requiredFeatures?.length) {
      const hasAccess = await this.subscriptionsService.hasFeatureAccess(
        context.tenantId,

        requiredFeatures,
      );

      if (!hasAccess) {
        throw new ForbiddenException({
          message: 'This feature is not available on your current plan or trial',

          code: 'FEATURE_NOT_AVAILABLE',

          requiredFeatures,
        });
      }
    }
  }

  private async queueForApproval(
    tenantId: string,

    action: AgentActionName,

    params: Record<string, unknown>,

    context: AgentActionContext,
  ): Promise<Record<string, unknown>> {
    if (context.idempotencyKey) {
      const existing = await this.pendingActionRepository.findOne({
        where: {
          tenantId,

          idempotencyKey: context.idempotencyKey,

          status: 'awaiting_approval',
        },
      });

      if (existing) {
        return {
          status: existing.status,

          pendingActionId: existing.id,

          correlationId: context.correlationId,

          code: 'AGENT_ACTION_PENDING_APPROVAL',
        };
      }
    }

    const pending = await this.pendingActionRepository.save({
      tenantId,

      action,

      params,

      status: 'awaiting_approval',

      requestedByMemberId: context.memberId,

      apiKeyId: context.apiKeyId ?? null,

      correlationId: context.correlationId ?? null,

      idempotencyKey: context.idempotencyKey ?? null,

      actorType: context.actorType,
    });

    return {
      status: 'awaiting_approval',

      pendingActionId: pending.id,

      correlationId: context.correlationId,

      code: 'AGENT_ACTION_PENDING_APPROVAL',
    };
  }

  private async dispatch(
    action: AgentActionName,

    tenantId: string,

    params: Record<string, unknown>,

    context: AgentActionContext,
  ): Promise<Record<string, unknown>> {
    switch (action) {
      case 'employees.list':
        return this.handleEmployeesList(tenantId);

      case 'leave.balance':
        return this.handleLeaveBalance(tenantId, params, context);

      case 'leave.request':
        return this.handleLeaveRequest(tenantId, params, context);

      case 'leave.approve':
        return this.handleLeaveApprove(tenantId, params, context);

      case 'leave.reject':
        return this.handleLeaveReject(tenantId, params, context);

      case 'approvals.pending':
        return this.handleApprovalsPending(tenantId, context);

      case 'shoutout.send':
        return this.handleShoutoutSend(tenantId, params, context);

      case 'payroll.run.status':
        return this.handlePayrollRunStatus(tenantId, params, context);

      case 'payroll.run.create':
        return this.handlePayrollRunCreate(tenantId, params, context);

      default:
        throw new BadRequestException({
          message: `Unhandled action: ${action}`,

          code: 'AGENT_ACTION_UNKNOWN',
        });
    }
  }

  private async resolveTargetMemberId(
    tenantId: string,

    params: Record<string, unknown>,

    context: AgentActionContext,
  ): Promise<string> {
    const requested = params.memberId ? String(params.memberId) : context.memberId;

    if (requested === context.memberId) {
      return requested;
    }

    await this.managerAccessService.assertAdminOrSelfOrManagerOf(
      context.member,

      requested,

      tenantId,
    );

    return requested;
  }

  private async handleEmployeesList(tenantId: string) {
    const members = await this.tenantMembersService.listTenantMembers(tenantId);

    return {
      employees: members.map((member) => ({
        id: member.id,

        preferredName: member.preferredName,

        firstName: member.firstName,

        lastName: member.lastName,

        email: member.user?.email,

        role: member.role,

        isActive: member.isActive,
      })),
    };
  }

  private async handleLeaveBalance(
    tenantId: string,

    params: Record<string, unknown>,

    context: AgentActionContext,
  ) {
    const memberId = await this.resolveTargetMemberId(tenantId, params, context);

    const year = params.year ? Number(params.year) : undefined;

    const balances = await this.leaveService.getLeaveBalanceForMember(tenantId, memberId, year);

    return { memberId, balances };
  }

  private async handleLeaveRequest(
    tenantId: string,

    params: Record<string, unknown>,

    context: AgentActionContext,
  ) {
    const memberId = await this.resolveTargetMemberId(tenantId, params, context);

    const leave = await this.leaveService.createLeave(tenantId, memberId, {
      leaveTypeId: String(params.leaveTypeId),

      startDate: new Date(String(params.startDate)),

      endDate: new Date(String(params.endDate)),

      reason: params.reason ? String(params.reason) : '',
    });

    return { leaveId: leave.id, status: leave.status };
  }

  private async handleLeaveApprove(
    tenantId: string,

    params: Record<string, unknown>,

    context: AgentActionContext,
  ) {
    const leaveId = String(params.leaveId);

    await this.leaveAuthorizationService.assertCanApproveOrReject(
      tenantId,

      context.member,

      leaveId,
    );

    const leave = await this.leaveService.approveLeave(
      tenantId,

      leaveId,

      context.memberId,

      params.comments ? String(params.comments) : undefined,
    );

    return { leaveId: leave.id, status: leave.status };
  }

  private async handleLeaveReject(
    tenantId: string,

    params: Record<string, unknown>,

    context: AgentActionContext,
  ) {
    const leaveId = String(params.leaveId);

    await this.leaveAuthorizationService.assertCanApproveOrReject(
      tenantId,

      context.member,

      leaveId,
    );

    const leave = await this.leaveService.rejectLeave(
      tenantId,

      leaveId,

      context.memberId,

      String(params.comments ?? 'Rejected via agent'),
    );

    return { leaveId: leave.id, status: leave.status };
  }

  private async handleApprovalsPending(tenantId: string, context: AgentActionContext) {
    const leaves = await this.leaveAuthorizationService.listPendingLeavesForApprover(
      tenantId,

      context.member,

      { page: 1, limit: 25 },

      { status: LeaveStatus.PENDING },
    );

    const agentPending = await this.listPendingApprovals(tenantId);

    return {
      leaves: leaves.records,

      agentActions: agentPending.map((item) => ({
        id: item.id,

        action: item.action,

        status: item.status,

        createdAt: item.createdAt,
      })),
    };
  }

  private async handleShoutoutSend(
    tenantId: string,

    params: Record<string, unknown>,

    context: AgentActionContext,
  ) {
    const recipients = Array.isArray(params.recipients) ? params.recipients : [];

    const shoutout = await this.shoutoutsService.createShoutout(tenantId, context.memberId, {
      message: String(params.message ?? ''),

      recipients: recipients.map((entry) => {
        const item = entry as { recipientId?: string; points?: number };

        return {
          recipientId: String(item.recipientId),

          points: Number(item.points ?? 10),
        };
      }),

      categoryIds: [],

      source: 'api',
    });

    return { shoutoutId: shoutout.id };
  }

  private async handlePayrollRunStatus(
    tenantId: string,

    params: Record<string, unknown>,

    context: AgentActionContext,
  ) {
    const run = await this.payrollService.getPayrollRunForRequester(
      String(params.runId),

      tenantId,

      context.memberId,

      context.member.role,
    );

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    return {
      runId: run.id,

      status: run.status,

      title: run.title,

      periodStart: run.periodStart,

      periodEnd: run.periodEnd,

      employeeCount: run.employeeCount,
    };
  }

  private async handlePayrollRunCreate(
    tenantId: string,

    params: Record<string, unknown>,

    context: AgentActionContext,
  ) {
    const run = await this.payrollService.createPayrollRun(
      {
        title: String(params.title),

        frequency: params.frequency as never,

        periodStart: new Date(String(params.periodStart)),

        periodEnd: new Date(String(params.periodEnd)),

        paymentDate: new Date(String(params.paymentDate)),

        baseCurrency: String(params.baseCurrency ?? 'NGN'),

        employeeIds: (params.employeeIds as string[]) ?? [],
      },

      tenantId,

      context.memberId,

      context.idempotencyKey,
    );

    return { runId: run.id, status: run.status, alreadyExists: run.alreadyExists ?? false };
  }

  private async recordSuccess(
    tenantId: string,

    action: AgentActionName,

    context: AgentActionContext,

    result: Record<string, unknown>,

    actorMemberId?: string,
  ): Promise<void> {
    if (context.idempotencyKey) {
      try {
        await this.idempotencyRepository.save({
          tenantId,

          idempotencyKey: context.idempotencyKey,

          action,

          response: result,
        });
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
          const cached = await this.idempotencyRepository.findOne({
            where: { tenantId, idempotencyKey: context.idempotencyKey },
          });

          if (cached && cached.action !== action) {
            throw new ConflictException({
              message: 'Idempotency key reused with a different action',

              code: 'IDEMPOTENCY_CONFLICT',
            });
          }
        } else {
          throw error;
        }
      }
    }

    const sanitizedResult = { ...result };

    delete sanitizedResult.correlationId;

    await this.activitiesService.queueActivity({
      tenantId,

      actorMemberId: actorMemberId ?? context.memberId,

      action: `agent.${action}`,

      resourceType: 'agent_action',

      resourceId:
        (typeof result.leaveId === 'string' && result.leaveId) ||
        (typeof result.runId === 'string' && result.runId) ||
        (typeof result.shoutoutId === 'string' && result.shoutoutId) ||
        context.idempotencyKey ||
        context.correlationId ||
        null,

      description: `Agent action executed: ${action}`,

      actorType: context.actorType,

      correlationId: context.correlationId ?? null,

      metadata: {
        action,

        ...(typeof result.leaveId === 'string' ? { leaveId: result.leaveId } : {}),

        ...(typeof result.runId === 'string' ? { runId: result.runId } : {}),

        ...(typeof result.shoutoutId === 'string' ? { shoutoutId: result.shoutoutId } : {}),
      },
    });
  }
}
