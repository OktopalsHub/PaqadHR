import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { IAuthenticatedUserRequest } from '../interfaces';
export const CurrentUser = createParamDecorator(
  (data: undefined, ctx: ExecutionContext): IAuthenticatedUserRequest => {
    const request = ctx.switchToHttp().getRequest<IAuthenticatedUserRequest>();
    if (!request.auth) {
      throw new UnauthorizedException('No authenticated user found');
    }
    return request;
  },
);
