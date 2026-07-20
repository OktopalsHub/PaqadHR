function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

export function isSubdomainTenantsEnabled(): boolean {
  return process.env.APP_USE_SUBDOMAIN === 'true';
}

export function getAppDomain(): string {
  return process.env.APP_DOMAIN || 'paqadhr.com';
}

function frontendBaseUrl(): string {
  return stripTrailingSlash(process.env.FRONTEND_URL || 'http://localhost:3000');
}

export function buildTenantHost(slug: string): string {
  const appDomain = getAppDomain();
  let hostname: string;
  try {
    hostname = new URL(frontendBaseUrl()).hostname;
  } catch {
    hostname = 'localhost';
  }

  if (hostname.endsWith('.localhost') || hostname === 'localhost') {
    const port = (() => {
      try {
        return new URL(frontendBaseUrl()).port;
      } catch {
        return '';
      }
    })();
    return `${slug}.localhost${port ? `:${port}` : ''}`;
  }

  if (hostname === `dev.${appDomain}` || hostname.endsWith(`.dev.${appDomain}`)) {
    return `${slug}.dev.${appDomain}`;
  }

  return `${slug}.${appDomain}`;
}

export function tenantFrontendUrl(slug: string, path = '/'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = frontendBaseUrl();

  if (!slug) {
    return normalized === '/' ? `${base}/` : `${base}${normalized}`;
  }

  if (isSubdomainTenantsEnabled()) {
    const protocol = (() => {
      try {
        return new URL(base).protocol;
      } catch {
        return 'http:';
      }
    })();
    const host = buildTenantHost(slug);
    return normalized === '/' ? `${protocol}//${host}/` : `${protocol}//${host}${normalized}`;
  }

  if (normalized === '/') return `${base}/${slug}`;
  return `${base}/${slug}${normalized}`;
}

export function isAllowedTenantFrontendOrigin(slug: string, origin: string): boolean {
  try {
    if (new URL(tenantFrontendUrl(slug, '/')).origin === origin) return true;
  } catch {
    // fall through
  }

  if (isSubdomainTenantsEnabled()) {
    try {
      return new URL(frontendBaseUrl()).origin === origin;
    } catch {
      return false;
    }
  }

  return false;
}
