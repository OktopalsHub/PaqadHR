import { apiOriginFromBase, resolveApiBaseUrl, resolveHostApiBaseUrl } from '../api-origin';
import { BRAND_ORIGIN } from '../brand';
import { buildContentSecurityPolicyFromSources } from './content-security-policy-core';

function getR2PublicOrigin(): string | undefined {
  return process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, '');
}

/**
 * API origins the browser may legitimately call for this request.
 *
 * The client bundle picks its API base from `NEXT_PUBLIC_API_URL` when that was
 * inlined at build time, otherwise from `window.location.hostname`. The Worker
 * runtime can hold a different `NEXT_PUBLIC_API_URL` (e.g. a stale dashboard var
 * that `--keep-vars` preserves), so we union the env-derived origin with the
 * host-derived one to avoid blocking a first-party API call the browser makes.
 */
function collectApiOrigins(requestHost?: string): string[] {
  const envOrigin = apiOriginFromBase(resolveApiBaseUrl({ requestHost }));
  const hostBaseUrl = resolveHostApiBaseUrl(requestHost);
  const hostOrigin = hostBaseUrl ? apiOriginFromBase(hostBaseUrl) : undefined;

  const origins = new Set([envOrigin]);
  if (hostOrigin) origins.add(hostOrigin);
  return [...origins];
}

export function buildContentSecurityPolicy(requestHost?: string, scriptNonce?: string): string {
  const [apiOrigin, ...additionalApiOrigins] = collectApiOrigins(requestHost);

  return buildContentSecurityPolicyFromSources({
    apiOrigin,
    additionalApiOrigins,
    brandOrigin: BRAND_ORIGIN,
    isDevelopment: process.env.NODE_ENV === 'development',
    r2PublicOrigin: getR2PublicOrigin(),
    scriptNonce,
  });
}
