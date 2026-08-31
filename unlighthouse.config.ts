import { existsSync, readFileSync } from 'node:fs';
import { defineUnlighthouseConfig } from 'unlighthouse/config';

type Cookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
};

type AuthState = {
  cookies?: Cookie[];
  site?: string;
  tenantSlug?: string;
};

function loadAuthState(): AuthState {
  const file = 'unlighthouse.cookies.json';
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as AuthState | Cookie[];
    // New shape: { cookies, site, tenantSlug }
    if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.cookies)) {
      return parsed;
    }
    // Legacy shape: bare Cookie[]
    if (Array.isArray(parsed) && parsed.length > 0) {
      return { cookies: parsed };
    }
  } catch {
    // ignore corrupt cookie file
  }
  return {};
}

function cookiesFromEnv(): Cookie[] | undefined {
  const env = process.env.UNLIGHTHOUSE_COOKIES?.trim();
  if (!env) return undefined;
  return env.split(';').map((pair) => {
    const [name, ...rest] = pair.trim().split('=');
    return { name: name.trim(), value: rest.join('=').trim(), path: '/' };
  });
}

const auth = loadAuthState();
const authCookies = auth.cookies?.length ? auth.cookies : cookiesFromEnv();
const tenantSlug =
  process.env.UNLIGHTHOUSE_TENANT_SLUG?.trim() || auth.tenantSlug?.trim() || undefined;
const site =
  process.env.UNLIGHTHOUSE_SITE?.trim() ||
  auth.site?.trim() ||
  'http://localhost:3000';

function isTenantHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith('.localhost')) {
      const sub = host.slice(0, -'.localhost'.length);
      return Boolean(sub && !sub.includes('.') && !['www', 'dev', 'api', 'api-dev'].includes(sub));
    }
    const appDomain = 'paqadhr.com';
    if (host === appDomain || host === `www.${appDomain}` || host === `dev.${appDomain}`) {
      return false;
    }
    if (host.endsWith(`.dev.${appDomain}`)) {
      const sub = host.slice(0, -`.dev.${appDomain}`.length);
      return Boolean(sub && !sub.includes('.'));
    }
    if (host.endsWith(`.${appDomain}`)) {
      const sub = host.slice(0, -`.${appDomain}`.length);
      return Boolean(sub && !sub.includes('.') && !['www', 'api', 'api-dev'].includes(sub));
    }
  } catch {
    // ignore
  }
  return false;
}

/** Public marketing + auth funnel — default scan target. */
const PUBLIC_URLS = [
  '/',
  '/privacy',
  '/terms',
  '/dpa',
  '/subprocessors',
  '/signin',
  '/signup',
  '/reset-password',
];

function privateUrls(): string[] {
  if (!tenantSlug) return PUBLIC_URLS;
  if (isTenantHost(site)) {
    return ['/', '/careers', '/employees', '/payroll', '/leaves', '/attendance', '/settings'];
  }
  // Apex host with path-prefix tenants (localhost:3000/{slug}/…)
  return [
    '/',
    '/privacy',
    '/terms',
    `/${tenantSlug}`,
    `/${tenantSlug}/employees`,
    `/${tenantSlug}/payroll`,
    `/${tenantSlug}/leaves`,
    `/${tenantSlug}/settings`,
  ];
}

// Private app routes only when explicitly requested (pnpm unlighthouse:auth).
const scanningPrivate =
  process.env.UNLIGHTHOUSE_PRIVATE === '1' && Boolean(authCookies && tenantSlug);

export default defineUnlighthouseConfig({
  site,
  // Explicit URL list disables sitemap/crawler — intentional for predictable scans.
  urls: scanningPrivate ? privateUrls() : PUBLIC_URLS,
  ...(scanningPrivate && authCookies ? { cookies: authCookies } : {}),
  cache: false,
  outputPath: './.unlighthouse',
  scanner: {
    // Next.js app shell needs JS for meaningful SEO/link extraction if crawler is on.
    skipJavascript: false,
    samples: 1,
    device: 'mobile',
    // With explicit `urls`, crawler is off anyway; keep excludes as a safety net.
    exclude: scanningPrivate
      ? ['/app/**']
      : [
          '/app/**',
          '/*/activity/**',
          '/*/analytics/**',
          '/*/attendance/**',
          '/*/employees/**',
          '/*/leaves/**',
          '/*/payroll/**',
          '/*/recruitment/**',
          '/*/settings/**',
          '/*/subscribe/**',
        ],
    robotsTxt: false,
    sitemap: false,
  },
});
