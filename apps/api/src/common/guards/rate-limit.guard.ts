import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator';
import type { IAuthenticatedMemberRequest } from '../interfaces';
import type { RateLimitConfig } from '../interfaces/rate-limit-config.interface';
import { RateLimitService } from '../services/rate-limit.service';

/**
 * Enforces the `@RateLimit()` metadata set on controllers/handlers.
 *
 * Registered globally (see `app.module.ts`) so a decorated route is actually
 * throttled — the decorator alone only stores metadata.
 *
 * Buckets are keyed by route + caller identity:
 * - authenticated requests are keyed by the JWT principal (one bucket per user)
 * - public/unauthenticated requests are keyed by client IP
 *
 * The route key uses the express route pattern (not the raw path) so a limit
 * cannot be bypassed by varying path parameters such as `tenantId`.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<RateLimitConfig | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!config?.rules?.length) return true;

    const request = context.switchToHttp().getRequest<IAuthenticatedMemberRequest>();
    const key = this.buildKey(context, request);
    const result = await this.rateLimitService.checkRateLimit(key, config);

    if (!result.allowed) {
      const retryAfter = Math.max(1, result.retryAfter ?? 60);
      request.res?.setHeader?.('Retry-After', String(retryAfter));
      this.logger.warn(`Rate limit exceeded for ${key}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'Too many requests. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private buildKey(context: ExecutionContext, request: IAuthenticatedMemberRequest): string {
    const identity = request.auth?.principalId ?? request.member?.id ?? request.ip ?? 'anonymous';
    const route = request.route?.path ?? `${context.getClass().name}.${context.getHandler().name}`;
    return `${request.method ?? 'ANY'}:${route}:${identity}`;
  }
}
