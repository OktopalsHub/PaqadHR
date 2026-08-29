import type { ApiKeyScope } from './api-key-scopes';

/** Semantic agent actions exposed via the agent gateway. */
export const AGENT_ACTIONS = [
  'employees.list',
  'leave.balance',
  'leave.request',
  'leave.approve',
  'leave.reject',
  'approvals.pending',
  'shoutout.send',
  'payroll.run.status',
  'payroll.run.create',
] as const;

export type AgentActionName = (typeof AGENT_ACTIONS)[number];

export type AgentActorType = 'user' | 'api_key' | 'slack_bot' | 'system';

export type PendingAgentActionStatus = 'awaiting_approval' | 'approved' | 'rejected' | 'executed' | 'failed';

/** Actions that always require human approval before execution. */
export const HIGH_RISK_AGENT_ACTIONS: readonly AgentActionName[] = [
  'payroll.run.create',
  'leave.approve',
  'leave.reject',
];

export const AGENT_ACTION_REQUIRED_SCOPES: Record<AgentActionName, ApiKeyScope[]> = {
  'employees.list': ['employees:read', 'agent:actions'],
  'leave.balance': ['leaves:read', 'agent:actions'],
  'leave.request': ['leaves:write', 'agent:actions'],
  'leave.approve': ['approvals:write', 'agent:actions'],
  'leave.reject': ['approvals:write', 'agent:actions'],
  'approvals.pending': ['approvals:read', 'agent:actions'],
  'shoutout.send': ['shoutouts:write', 'agent:actions'],
  'payroll.run.status': ['payroll:read', 'agent:actions'],
  'payroll.run.create': ['payroll:write', 'agent:actions'],
};

export function isAgentActionName(value: string): value is AgentActionName {
  return (AGENT_ACTIONS as readonly string[]).includes(value);
}
