import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyRouteGuard } from './api-key-route.guard';

describe('ApiKeyRouteGuard', () => {
  const reflector = { getAllAndOverride: jest.fn(() => false) } as unknown as Reflector;
  const guard = new ApiKeyRouteGuard(reflector);

  it('allows API keys on agent routes', () => {
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          auth: { authType: 'api_key' },
          path: '/api/v1/tenants/tenant-1/agent/actions',
        }),
      }),
    };

    expect(guard.canActivate(context as never)).toBe(true);
  });

  it('allows API keys on version-neutral agent routes', () => {
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          auth: { authType: 'api_key' },
          path: '/agent/actions',
        }),
      }),
    };

    expect(guard.canActivate(context as never)).toBe(true);
  });

  it('blocks API keys on non-agent routes', () => {
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          auth: { authType: 'api_key' },
          path: '/api/v1/tenants/tenant-1/leaves',
        }),
      }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });
});
