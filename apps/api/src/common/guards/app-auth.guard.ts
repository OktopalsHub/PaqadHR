import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { IAuthenticatedUserRequest } from '../interfaces';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

function isApiKeyAuthorization(request: IAuthenticatedUserRequest): boolean {
  const header = request.headers.authorization;
  return typeof header === 'string' && header.startsWith('Bearer paq_');
}

@Injectable()
export class AppAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly apiKeyAuthGuard: ApiKeyAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<IAuthenticatedUserRequest>();
    if (isApiKeyAuthorization(request)) {
      return this.apiKeyAuthGuard.canActivate(context);
    }

    const result = await this.jwtAuthGuard.canActivate(context);
    return Boolean(result);
  }
}
