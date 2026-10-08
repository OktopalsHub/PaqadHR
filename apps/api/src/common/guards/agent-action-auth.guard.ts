import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  AGENT_ACTION_REQUIRED_SCOPES,
  isAgentActionName,
  type ApiKeyScope,
} from '@paqadhr/contracts';

/**
 * Shared scope authorization for agent action execute routes.
 *
 * Runs after JWT/API-key + member resolution. Feature/plan gating stays in
 * AgentActionsService (needs SubscriptionsService).
 */
@Injectable()
export class AgentActionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const action = request.body?.action;

    if (typeof action !== 'string' || !action) {
      throw new BadRequestException('action is required');
    }

    if (!isAgentActionName(action)) {
      throw new BadRequestException({
        message: `Unknown agent action: ${action}`,
        code: 'AGENT_ACTION_UNKNOWN',
      });
    }

    const actor = request.auth;
    if (!actor || actor.authType !== 'api_key' || !actor.apiKeyId) {
      throw new ForbiddenException({
        message: 'Agent gateway requires API key authentication',
        code: 'AGENT_API_KEY_REQUIRED',
      });
    }

    const scopes = actor.scopes;
    if (!Array.isArray(scopes)) {
      throw new ForbiddenException({
        message: 'API key lacks required scopes for this action',
        code: 'API_KEY_SCOPE_DENIED',
        missingScopes: AGENT_ACTION_REQUIRED_SCOPES[action],
      });
    }

    const scopeSet = new Set<ApiKeyScope>(scopes);
    const requiredScopes = AGENT_ACTION_REQUIRED_SCOPES[action];
    const missing = requiredScopes.filter((scope) => !scopeSet.has(scope));

    if (missing.length > 0) {
      throw new ForbiddenException({
        message: 'API key lacks required scopes for this action',
        code: 'API_KEY_SCOPE_DENIED',
        missingScopes: missing,
      });
    }

    const bodyTenantId = request.body?.tenantId;
    if (
      typeof bodyTenantId === 'string' &&
      actor.tenantId &&
      bodyTenantId !== actor.tenantId
    ) {
      throw new ForbiddenException('API key is not valid for this tenant');
    }

    return true;
  }
}
