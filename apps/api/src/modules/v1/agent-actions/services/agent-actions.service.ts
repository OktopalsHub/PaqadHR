import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AgentActionName,
  type AgentActorType,
  HIGH_RISK_AGENT_ACTIONS,
  isAgentActionName,
} from '@paqadhr/contracts';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import type { IAuthenticatedMemberRequest } from 'src/common/interfaces';
import { getRequestCorrelationId } from 'src/common/observability/correlation-id.storage';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { formatMemberDisplayName } from 'src/common/utils/member-display.util';
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
import type { AgentActionContext } from '../agents/agent-action.types';
import { AgentActionRegistry } from '../agents/agent-actions.registry';
import { registerAgentActionHandlers } from '../agents/register-agent-action-handlers';
import { hashAgentActionParams, validateAgentActionParams } from '../agent-action-params';
import type { ExecuteAgentActionDto } from '../dto/execute-agent-action.dto';
import { PendingAgentActionListItemDto } from '../dto/pending-agent-action-list-item.dto';
import { AgentActionIdempotency } from '../entities/agent-action-idempotency.entity';
import { PendingAgentAction } from '../entities/pending-agent-action.entity';

export type { AgentActionContext };

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
    private readonly agentActionRegistry: AgentActionRegistry,
    private readonly tenantMembersService: TenantMembersService,
    private readonly leaveService: LeaveService,
    private readonly leaveAuthorizationService: LeaveAuthorizationService,
    private readonly managerAccessService: ManagerAccessService,
    private readonly shoutoutsService: ShoutoutsService,
    private readonly payrollService: PayrollService,
    private readonly activitiesService: ActivitiesService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {
    registerAgentActionHandlers(this.agentActionRegistry, {
      tenantMembersService: this.tenantMembersService,
      leaveService: this.leaveService,
      leaveAuthorizationService: this.leaveAuthorizationService,
      managerAccessService: this.managerAccessService,
      shoutoutsService: this.shoutoutsService,
      payrollService: this.payrollService,
      listPendingApprovals: (tenantId) => this.listPendingApprovals(tenantId),
    });
  }

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

    const action = dto.action;
    validateAgentActionParams(action, dto.params);
    const paramsHash = hashAgentActionParams(dto.params);
    const context = this.buildContext(tenantId, request, idempotencyKey);

    await this.assertFeatureAccess(context.tenantId, action);

    if (idempotencyKey) {
      const cached = await this.idempotencyRepository.findOne({
        where: { tenantId, idempotencyKey },
      });

      if (cached) {
        if (cached.action !== action || cached.paramsHash !== paramsHash) {
          throw new ConflictException({
            message: 'Idempotency key reused with a different action or payload',
            code: 'IDEMPOTENCY_CONFLICT',
          });
        }
        return { ...cached.response, correlationId: context.correlationId, cached: true };
      }
    }

    if ((HIGH_RISK_AGENT_ACTIONS as readonly string[]).includes(action)) {
      return this.queueForApproval(tenantId, action, dto.params, context, paramsHash);
    }

    const result = await this.dispatch(action, tenantId, dto.params, context);
    await this.recordSuccess(tenantId, action, context, result, undefined, paramsHash);
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
    const claimResult = await this.pendingActionRepository.update(
      { id: actionId, tenantId, status: 'awaiting_approval' },
      {
        status: 'executing',
        approvedByMemberId: approverMemberId,
      },
    );

    if (!claimResult.affected) {
      throw new NotFoundException('Pending action not found');
    }

    const pending = await this.pendingActionRepository.findOne({
      where: { id: actionId, tenantId, status: 'executing' },
    });

    if (!pending) {
      throw new ConflictException('Pending action was already processed');
    }

    if (!isAgentActionName(pending.action)) {
      await this.pendingActionRepository.update(
        { id: actionId, tenantId, status: 'executing' },
        { status: 'failed', result: { code: 'AGENT_ACTION_UNKNOWN' } as never },
      );
      throw new BadRequestException('Invalid pending action');
    }

    const action = pending.action;
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

    try {
      const result = await this.dispatch(action, tenantId, pending.params, context);

      const finalizeResult = await this.pendingActionRepository.update(
        { id: actionId, tenantId, status: 'executing' },
        {
          status: 'executed',
          result: result as never,
        },
      );

      if (!finalizeResult.affected) {
        throw new ConflictException('Pending action was already processed');
      }

      const paramsHash = hashAgentActionParams(pending.params);
      await this.recordSuccess(tenantId, action, context, result, approverMemberId, paramsHash);

      return { ...result, correlationId: context.correlationId, pendingActionId: pending.id };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Agent action execution failed';
      await this.pendingActionRepository.update(
        { id: actionId, tenantId, status: 'executing' },
        {
          status: 'failed',
          result: { message, code: 'AGENT_ACTION_FAILED' } as never,
        },
      );
      throw error;
    }
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

  /** Feature/plan gating. Scope checks live in AgentActionAuthGuard. */
  private async assertFeatureAccess(tenantId: string, action: AgentActionName): Promise<void> {
    const requiredFeatures = ACTION_FEATURE_REQUIREMENTS[action];
    if (!requiredFeatures?.length) {
      return;
    }

    const hasAccess = await this.subscriptionsService.hasFeatureAccess(tenantId, requiredFeatures);
    if (!hasAccess) {
      throw new ForbiddenException({
        message: 'This feature is not available on your current plan or trial',
        code: 'FEATURE_NOT_AVAILABLE',
        requiredFeatures,
      });
    }
  }

  private async queueForApproval(
    tenantId: string,
    action: AgentActionName,
    params: Record<string, unknown>,
    context: AgentActionContext,
    paramsHash: string,
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
        if (existing.action !== action || hashAgentActionParams(existing.params) !== paramsHash) {
          throw new ConflictException({
            message: 'Idempotency key reused with a different action or payload',
            code: 'IDEMPOTENCY_CONFLICT',
          });
        }

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
    const handler = this.agentActionRegistry.get(action);
    if (!handler) {
      throw new BadRequestException({
        message: `Unhandled action: ${action}`,
        code: 'AGENT_ACTION_UNKNOWN',
      });
    }
    return handler(tenantId, params, context);
  }

  private async recordSuccess(
    tenantId: string,
    action: AgentActionName,
    context: AgentActionContext,
    result: Record<string, unknown>,
    actorMemberId?: string,
    paramsHash?: string,
  ): Promise<void> {
    if (context.idempotencyKey) {
      if (!paramsHash) {
        throw new BadRequestException('paramsHash required when Idempotency-Key is set');
      }

      try {
        await this.idempotencyRepository.save({
          tenantId,
          idempotencyKey: context.idempotencyKey,
          action,
          paramsHash,
          response: result,
        });
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
          const cached = await this.idempotencyRepository.findOne({
            where: { tenantId, idempotencyKey: context.idempotencyKey },
          });

          if (cached && (cached.action !== action || cached.paramsHash !== paramsHash)) {
            throw new ConflictException({
              message: 'Idempotency key reused with a different action or payload',
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
