import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { IAuthenticatedUserRequest } from '../interfaces';

const API_KEY_ALLOWED_PATHS = [
  /^\/api\/v1\/tenants\/[^/]+\/agent(\/|$)/,
  /^\/agent(\/|$)/,
];

@Injectable()
export class ApiKeyRouteGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<IAuthenticatedUserRequest>();
    if (request.auth?.authType !== 'api_key') {
      return true;
    }

    const path = request.path ?? request.url ?? '';
    if (API_KEY_ALLOWED_PATHS.some((pattern) => pattern.test(path))) {
      return true;
    }

    throw new ForbiddenException({
      message: 'API keys may only access agent gateway routes',
      code: 'API_KEY_ROUTE_DENIED',
    });
  }
}
