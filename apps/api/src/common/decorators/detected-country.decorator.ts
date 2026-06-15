import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const DetectedCountry = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ countryCode?: string }>();
    return request.countryCode || 'GLOBAL';
  },
);
