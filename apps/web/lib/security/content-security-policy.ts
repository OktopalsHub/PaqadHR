import { apiOriginFromBase, resolveApiBaseUrl } from '../api-origin';
import { BRAND_ORIGIN } from '../brand';
import { buildContentSecurityPolicyFromSources } from './content-security-policy-core';

function getR2PublicOrigin(): string | undefined {
  return process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, '');
}

export function buildContentSecurityPolicy(requestHost?: string): string {
  return buildContentSecurityPolicyFromSources({
    apiOrigin: apiOriginFromBase(resolveApiBaseUrl({ requestHost })),
    brandOrigin: BRAND_ORIGIN,
    isDevelopment: process.env.NODE_ENV === 'development',
    r2PublicOrigin: getR2PublicOrigin(),
  });
}
