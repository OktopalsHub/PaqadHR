import { NotFoundException } from '@nestjs/common';
import { LeaveStatus } from 'src/common/enums';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { LeaveService } from '../../leave/leave.service';
import { LeaveAuthorizationService } from '../../leave/services/leave-authorization.service';
import { PayrollService } from '../../payroll/services/payroll.service';
import { ShoutoutsService } from '../../shoutouts/services/shoutouts.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type { PendingAgentActionListItemDto } from '../dto/pending-agent-action-list-item.dto';
import type { AgentActionContext } from './agent-action.types';
import type { AgentActionRegistry } from './agent-actions.registry';

export interface AgentActionHandlerDeps {
  tenantMembersService: TenantMembersService;
  leaveService: LeaveService;
  leaveAuthorizationService: LeaveAuthorizationService;
  managerAccessService: ManagerAccessService;
  shoutoutsService: ShoutoutsService;
  payrollService: PayrollService;
  listPendingApprovals: (tenantId: string) => Promise<PendingAgentActionListItemDto[]>;
}

async function resolveTargetMemberId(
  deps: AgentActionHandlerDeps,
  tenantId: string,
  params: Record<string, unknown>,
  context: AgentActionContext,
): Promise<string> {
  const requested = params.memberId ? String(params.memberId) : context.memberId;
  if (requested === context.memberId) {
    return requested;
  }
  await deps.managerAccessService.assertAdminOrSelfOrManagerOf(
    context.member,
    requested,
    tenantId,
  );
  return requested;
}

/** Registers all known agent action handlers. Call once at service construction. */
export function registerAgentActionHandlers(
  registry: AgentActionRegistry,
  deps: AgentActionHandlerDeps,
): void {
  registry.register('employees.list', async (tenantId) => {
    const members = await deps.tenantMembersService.listTenantMembers(tenantId);
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
  });

  registry.register('leave.balance', async (tenantId, params, context) => {
    const memberId = await resolveTargetMemberId(deps, tenantId, params, context);
    const year = params.year ? Number(params.year) : undefined;
    const balances = await deps.leaveService.getLeaveBalanceForMember(tenantId, memberId, year);
    return { memberId, balances };
  });

  registry.register('leave.request', async (tenantId, params, context) => {
    const memberId = await resolveTargetMemberId(deps, tenantId, params, context);
    const leave = await deps.leaveService.createLeave(tenantId, memberId, {
      leaveTypeId: String(params.leaveTypeId),
      startDate: new Date(String(params.startDate)),
      endDate: new Date(String(params.endDate)),
      reason: params.reason ? String(params.reason) : '',
    });
    return { leaveId: leave.id, status: leave.status };
  });

  registry.register('leave.approve', async (tenantId, params, context) => {
    const leaveId = String(params.leaveId);
    await deps.leaveAuthorizationService.assertCanApproveOrReject(
      tenantId,
      context.member,
      leaveId,
    );
    const leave = await deps.leaveService.approveLeave(
      tenantId,
      leaveId,
      context.memberId,
      params.comments ? String(params.comments) : undefined,
    );
    return { leaveId: leave.id, status: leave.status };
  });

  registry.register('leave.reject', async (tenantId, params, context) => {
    const leaveId = String(params.leaveId);
    await deps.leaveAuthorizationService.assertCanApproveOrReject(
      tenantId,
      context.member,
      leaveId,
    );
    const leave = await deps.leaveService.rejectLeave(
      tenantId,
      leaveId,
      context.memberId,
      String(params.comments ?? 'Rejected via agent'),
    );
    return { leaveId: leave.id, status: leave.status };
  });

  registry.register('approvals.pending', async (tenantId, _params, context) => {
    const leaves = await deps.leaveAuthorizationService.listPendingLeavesForApprover(
      tenantId,
      context.member,
      { page: 1, limit: 25 },
      { status: LeaveStatus.PENDING },
    );
    const agentPending = await deps.listPendingApprovals(tenantId);
    return {
      leaves: leaves.records,
      agentActions: agentPending.map((item) => ({
        id: item.id,
        action: item.action,
        status: item.status,
        createdAt: item.createdAt,
      })),
    };
  });

  registry.register('shoutout.send', async (tenantId, params, context) => {
    const recipients = Array.isArray(params.recipients) ? params.recipients : [];
    const shoutout = await deps.shoutoutsService.createShoutout(tenantId, context.memberId, {
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
  });

  registry.register('payroll.run.status', async (tenantId, params, context) => {
    const run = await deps.payrollService.getPayrollRunForRequester(
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
  });

  registry.register('payroll.run.create', async (tenantId, params, context) => {
    const run = await deps.payrollService.createPayrollRun(
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
  });
}
