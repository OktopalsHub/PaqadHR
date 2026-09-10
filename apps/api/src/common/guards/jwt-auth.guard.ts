import { type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { IAuthenticatedUserRequest, JwtPayload } from '../interfaces';
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
  isJwtPayload(user: unknown): user is JwtPayload {
    return (
      !!user &&
      typeof user === 'object' &&
      'principalId' in user &&
      'email' in user &&
      'role' in user
    );
  }
  handleRequest<TUser = JwtPayload>(
    err: unknown,
    user: unknown,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    const request = context.switchToHttp().getRequest<IAuthenticatedUserRequest>();
    if (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new UnauthorizedException(`Authentication error: ${message}`);
    }
    if (!user || !this.isJwtPayload(user)) {
      throw new UnauthorizedException('User is unauthenticated');
    }
    request.auth = {
      principalId: user.principalId,
      email: user.email,
      role: user.role,
      authType: 'user',
    };
    return user as TUser;
  }
}
