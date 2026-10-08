import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyRouteGuard } from './api-key-route.guard';

describe('ApiKeyRouteGuard', () => {
  const reflector = { getAllAndOverride: jest.fn(() => false) } as unknown as Reflector;
  const guard = new ApiKeyRouteGuard(reflector);

  function contextFor(path: string, authType: string | undefined = 'api_key') {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          auth: authType ? { authType } : undefined,
          path,
        }),
      }),
    };
  }

  it('allows API keys on tenant agent execute routes', () => {
    expect(guard.canActivate(contextFor('/api/v1/tenants/tenant-1/agent/actions') as never)).toBe(
      true,
    );
  });

  it('allows API keys on version-neutral agent execute routes', () => {
    expect(guard.canActivate(contextFor('/agent/actions') as never)).toBe(true);
  });

  it('blocks API keys on agent approval routes', () => {
    expect(() =>
      guard.canActivate(contextFor('/api/v1/tenants/tenant-1/agent/approvals/pending') as never),
    ).toThrow(ForbiddenException);

    expect(() =>
      guard.canActivate(
        contextFor('/api/v1/tenants/tenant-1/agent/approvals/action-1/approve') as never,
      ),
    ).toThrow(ForbiddenException);
  });

  it('blocks API keys on non-agent routes', () => {
    expect(() => guard.canActivate(contextFor('/api/v1/tenants/tenant-1/leaves') as never)).toThrow(
      ForbiddenException,
    );
  });

  it('allows JWT sessions on any authenticated route', () => {
    expect(guard.canActivate(contextFor('/api/v1/tenants/tenant-1/leaves', 'user') as never)).toBe(
      true,
    );
  });
});
