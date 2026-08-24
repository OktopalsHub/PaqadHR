const CROSS_SITE_COOKIE_VALUE = 'true';

export function usesCrossSiteCookies(): boolean {
  return process.env.COOKIE_CROSS_SITE?.trim().toLowerCase() === CROSS_SITE_COOKIE_VALUE;
}

export function resolveCookieDomain(): string | undefined {
  if (!usesCrossSiteCookies()) return undefined;

  const appDomain = process.env.APP_DOMAIN?.trim();
  return appDomain && appDomain !== 'localhost' ? `.${appDomain}` : undefined;
}
