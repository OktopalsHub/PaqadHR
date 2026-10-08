import type { AgentActorType, ApiKeyScope } from '@paqadhr/contracts';
import type { MemberContext } from 'src/common/interfaces';

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

/** One invocation of a registered agent action. */
export type AgentActionHandler = (
  tenantId: string,
  params: Record<string, unknown>,
  context: AgentActionContext,
) => Promise<Record<string, unknown>>;
