import { getAppDomain, isSubdomainTenantsEnabled } from '../utils/tenant-frontend-url.util';

export function resolveTrustedOrigins(): string[] {
  const raw =
    process.env.TRUSTED_ORIGINS ||
    process.env.ALLOWED_ORIGINS ||
    process.env.CORS_ALLOWED_ORIGINS ||
    '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isWildcardTenantOrigin(origin: string): boolean {
  if (!isSubdomainTenantsEnabled()) return false;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  const host = url.hostname.toLowerCase();
  const appDomain = getAppDomain();

  if (host.endsWith('.localhost')) {
    const sub = host.slice(0, -'.localhost'.length);
    return Boolean(sub) && !sub.includes('.');
  }

  const devSuffix = `.dev.${appDomain}`;
  if (host.endsWith(devSuffix)) {
    const sub = host.slice(0, -devSuffix.length);
    return Boolean(sub) && !sub.includes('.');
  }

  const prodSuffix = `.${appDomain}`;
  if (host.endsWith(prodSuffix) && host !== `www.${appDomain}` && host !== appDomain) {
    const sub = host.slice(0, -prodSuffix.length);
    return Boolean(sub) && !sub.includes('.');
  }

  return false;
}

export function isTrustedOrigin(origin: string): boolean {
  const allowedOrigins = resolveTrustedOrigins();
  if (allowedOrigins.includes(origin)) return true;
  return isWildcardTenantOrigin(origin);
}
