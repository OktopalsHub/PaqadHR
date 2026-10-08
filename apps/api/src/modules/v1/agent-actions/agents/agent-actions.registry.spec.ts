import { AgentActionRegistry } from './agent-actions.registry';
import { registerAgentActionHandlers } from './register-agent-action-handlers';
import type { AgentActionHandlerDeps } from './register-agent-action-handlers';

const REGISTERED_ACTIONS = [
  'approvals.pending',
  'employees.list',
  'leave.approve',
  'leave.balance',
  'leave.reject',
  'leave.request',
  'payroll.run.create',
  'payroll.run.status',
  'shoutout.send',
] as const;

function stubDeps(): AgentActionHandlerDeps {
  return {
    tenantMembersService: { listTenantMembers: async () => [] } as never,
    leaveService: {} as never,
    leaveAuthorizationService: {} as never,
    managerAccessService: {} as never,
    shoutoutsService: {} as never,
    payrollService: {} as never,
    listPendingApprovals: async () => [],
  };
}

describe('AgentActionRegistry', () => {
  it('registers the shipped agent actions exactly once', () => {
    const registry = new AgentActionRegistry();
    registerAgentActionHandlers(registry, stubDeps());

    expect(registry.list().sort()).toEqual([...REGISTERED_ACTIONS]);
  });

  it('rejects duplicate registration', () => {
    const registry = new AgentActionRegistry();
    registry.register('employees.list', async () => ({}));
    expect(() => registry.register('employees.list', async () => ({}))).toThrow(
      /already registered/,
    );
  });

  it('returns undefined for unknown actions', () => {
    const registry = new AgentActionRegistry();
    expect(registry.get('employees.list')).toBeUndefined();
  });

  it('dispatches a registered handler', async () => {
    const registry = new AgentActionRegistry();
    registry.register('employees.list', async (tenantId) => ({ tenantId, ok: true }));

    const result = await registry.get('employees.list')!('t1', {}, {
      tenantId: 't1',
      memberId: 'm1',
      member: { id: 'm1', role: 'ADMIN', memberId: 'm1' },
      actorType: 'api_key',
    });

    expect(result).toEqual({ tenantId: 't1', ok: true });
  });
});
