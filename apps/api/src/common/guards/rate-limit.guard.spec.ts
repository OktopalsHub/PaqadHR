import { type ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimit } from 'src/common/decorators';
import type { IAuthenticatedMemberRequest } from 'src/common/interfaces';
import { RateLimitGuard } from './rate-limit.guard';

class RateLimitedController {
  @RateLimit({ rules: [{ windowMs: 60_000, maxRequests: 2 }] })
  limited(): void {}

  undecorated(): void {}
}

function createContext(options: {
  handler: (...args: never[]) => unknown;
  principalId?: string;
  ip?: string;
  setHeader?: jest.Mock;
}): ExecutionContext {
  const request = {
    method: 'POST',
    ip: options.ip ?? '203.0.113.10',
    auth: options.principalId ? { principalId: options.principalId } : undefined,
    res: { setHeader: options.setHeader ?? jest.fn() },
  } as unknown as IAuthenticatedMemberRequest;

  return {
    getClass: () => RateLimitedController,
    getHandler: () => options.handler,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let checkRateLimit: jest.Mock;

  beforeEach(() => {
    checkRateLimit = jest.fn();
    guard = new RateLimitGuard(new Reflector(), {
      checkRateLimit,
    } as never);
  });

  it('allows the request when the route has no rate limit metadata', async () => {
    await expect(
      guard.canActivate(createContext({ handler: RateLimitedController.prototype.undecorated })),
    ).resolves.toBe(true);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('allows the request while the caller is under the limit', async () => {
    checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 1,
      resetTime: Date.now() + 60_000,
    });

    await expect(
      guard.canActivate(
        createContext({ handler: RateLimitedController.prototype.limited, principalId: 'user-1' }),
      ),
    ).resolves.toBe(true);
  });

  it('throws 429 with a Retry-After header once the limit is exceeded', async () => {
    const setHeader = jest.fn();
    checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      retryAfter: 42,
    });

    const error = await guard
      .canActivate(
        createContext({
          handler: RateLimitedController.prototype.limited,
          principalId: 'user-1',
          setHeader,
        }),
      )
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });

  it('keys buckets by the authenticated principal so one user cannot exhaust another', async () => {
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 1, resetTime: Date.now() });

    await guard.canActivate(
      createContext({ handler: RateLimitedController.prototype.limited, principalId: 'user-1' }),
    );
    await guard.canActivate(
      createContext({ handler: RateLimitedController.prototype.limited, principalId: 'user-2' }),
    );

    const keys = checkRateLimit.mock.calls.map(([key]) => key);
    expect(new Set(keys).size).toBe(2);
    expect(keys[0]).toContain('user-1');
    expect(keys[1]).toContain('user-2');
  });

  it('falls back to the client IP for unauthenticated callers', async () => {
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 1, resetTime: Date.now() });

    await guard.canActivate(
      createContext({ handler: RateLimitedController.prototype.limited, ip: '198.51.100.7' }),
    );

    expect(checkRateLimit.mock.calls[0][0]).toContain('198.51.100.7');
  });

  it('enforces the rules declared on the route', async () => {
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 1, resetTime: Date.now() });

    await guard.canActivate(
      createContext({ handler: RateLimitedController.prototype.limited, principalId: 'user-1' }),
    );

    expect(checkRateLimit.mock.calls[0][1]).toEqual({
      rules: [{ windowMs: 60_000, maxRequests: 2 }],
    });
    expect(RATE_LIMIT_KEY).toBe('rateLimit');
  });
});
