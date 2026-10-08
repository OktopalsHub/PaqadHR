/** Scopes granted to tenant API keys. Money-movement scopes require explicit admin opt-in. */
export const API_KEY_SCOPES = [
  'employees:read',
  'leaves:read',
  'leaves:write',
  'shoutouts:read',
  'shoutouts:write',
  'payroll:read',
  'payroll:write',
  'approvals:read',
  'approvals:write',
  'agent:actions',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const HIGH_RISK_API_KEY_SCOPES: readonly ApiKeyScope[] = ['payroll:write'];

export function isApiKeyScope(value: string): value is ApiKeyScope {
  return (API_KEY_SCOPES as readonly string[]).includes(value);
}
