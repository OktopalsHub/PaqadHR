import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AgentActionAuthGuard } from './agent-action-auth.guard';

function httpContext(body: unknown, auth: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ body, auth }),
    }),
  } as never;
}

describe('AgentActionAuthGuard', () => {
  const guard = new AgentActionAuthGuard();

  it('allows an API key with required scopes', () => {
    expect(
      guard.canActivate(
        httpContext(
          { action: 'employees.list' },
          {
            authType: 'api_key',
            apiKeyId: 'key-1',
            tenantId: 't1',
            scopes: ['employees:read', 'agent:actions'],
          },
        ),
      ),
    ).toBe(true);
  });

  it('rejects missing scopes with API_KEY_SCOPE_DENIED', () => {
    try {
      guard.canActivate(
        httpContext(
          { action: 'employees.list' },
          {
            authType: 'api_key',
            apiKeyId: 'key-1',
            scopes: ['agent:actions'],
          },
        ),
      );
      fail('expected ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'API_KEY_SCOPE_DENIED',
        missingScopes: ['employees:read'],
      });
    }
  });

  it('rejects JWT actors', () => {
    expect(() =>
      guard.canActivate(
        httpContext(
          { action: 'employees.list' },
          { authType: 'user', principalId: 'u1' },
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects unknown actions', () => {
    expect(() =>
      guard.canActivate(
        httpContext(
          { action: 'not.real' },
          {
            authType: 'api_key',
            apiKeyId: 'key-1',
            scopes: ['agent:actions'],
          },
        ),
      ),
    ).toThrow(BadRequestException);
  });
});
