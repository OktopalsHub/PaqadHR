import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { tenantContext } from '../context/tenant.context';

export const CurrentTenantMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const member = tenantContext.getCurrentMember();
    if (member) return member;
    return ctx.switchToHttp().getRequest().member;
  },
);
