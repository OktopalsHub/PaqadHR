import type { Request } from 'express';

export function resolveTenantIdFromRequest(request: Request): string | undefined {
  const headerValue = request.headers['x-tenant-id'];
  const tenantId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return tenantId?.trim() || undefined;
}
