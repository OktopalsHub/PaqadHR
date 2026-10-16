const CROSS_SITE_COOKIE_VALUE = 'true';

/** Base (unnamespaced) auth cookie names. Always resolve them through `cookieName`. */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const CSRF_COOKIE = '_csrf';

const PRODUCTION_COOKIE_PREFIX = '';
const NON_PRODUCTION_COOKIE_PREFIX = 'dev_';

export function usesCrossSiteCookies(): boolean {
  return process.env.COOKIE_CROSS_SITE?.trim().toLowerCase() === CROSS_SITE_COOKIE_VALUE;
}

export function usesSecureCookies(): boolean {
  return process.env.NODE_ENV === 'production' || usesCrossSiteCookies();
}

export function resolveCookieDomain(): string | undefined {
  if (!usesCrossSiteCookies()) return undefined;

  const appDomain = process.env.APP_DOMAIN?.trim();
  return appDomain && appDomain !== 'localhost' ? `.${appDomain}` : undefined;
}

function normalizeCookiePrefix(value: string): string {
  return value.endsWith('_') ? value : `${value}_`;
}

/**
 * Namespace for auth cookie names so two deployments that share a browser can
 * hold independent sessions. Production stays unnamespaced (`access_token`,
 * `_csrf`); every other environment is prefixed (`dev_access_token`,
 * `dev_csrf`).
 *
 * This matters because production issues `Domain=.paqadhr.com` cookies, which
 * the browser also sends to `api-dev.paqadhr.com`. Without a distinct name the
 * dev API would receive production tokens signed with a different secret and
 * reject the session.
 *
 * Precedence:
 * 1. `COOKIE_NAME_PREFIX` (`dev` and `dev_` are equivalent) — explicit control.
 * 2. Non-production → `dev_`, mirroring `usesSecureCookies()` which already
 *    treats `NODE_ENV` as the deployment discriminator.
 */
export function resolveCookieNamePrefix(): string {
  const explicit = process.env.COOKIE_NAME_PREFIX?.trim();
  if (explicit) return normalizeCookiePrefix(explicit);
  return process.env.NODE_ENV === 'production'
    ? PRODUCTION_COOKIE_PREFIX
    : NON_PRODUCTION_COOKIE_PREFIX;
}

/** Resolves a base auth cookie name for the current deployment. */
export function cookieName(base: string): string {
  const prefix = resolveCookieNamePrefix();
  return prefix ? `${prefix}${base.replace(/^_+/, '')}` : base;
}
