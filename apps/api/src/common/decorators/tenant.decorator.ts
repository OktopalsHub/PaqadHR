import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { tenantContext } from '../context/tenant.context';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const tenant = tenantContext.getCurrentTenant();
    if (tenant) return tenant;
    return ctx.switchToHttp().getRequest().tenant;
  },
);

export const TenantSlug = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const tenant = tenantContext.getCurrentTenant();
    if (tenant) return tenant.slug;
    return ctx.switchToHttp().getRequest().tenant?.slug;
  },
);

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const tenant = tenantContext.getCurrentTenant();
    if (tenant) return tenant.id;
    const request = ctx.switchToHttp().getRequest();
    if (request.tenant?.id) return request.tenant.id;
    return request.params?.tenantId;
  },
);

export const REQUIRE_TENANT_KEY = 'requireTenant';
export const RequireTenant = () => SetMetadata(REQUIRE_TENANT_KEY, true);
