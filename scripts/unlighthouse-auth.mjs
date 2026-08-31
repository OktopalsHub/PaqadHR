#!/usr/bin/env node
/**
 * Login to Paqad API and save cookies for authenticated Unlighthouse scans.
 *
 * Usage:
 *   UNLIGHTHOUSE_AUTH_EMAIL=you@paqad.com UNLIGHTHOUSE_AUTH_PASSWORD=secret \
 *     node scripts/unlighthouse-auth.mjs
 *
 * Then:
 *   pnpm unlighthouse:auth
 *
 * Cookies must sit on the API host (browser sends them on credentialed XHR).
 * tenant_slug is also set on the web host for middleware.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const email = process.env.UNLIGHTHOUSE_AUTH_EMAIL;
const password = process.env.UNLIGHTHOUSE_AUTH_PASSWORD;
const apiUrlRaw =
  process.env.UNLIGHTHOUSE_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:9001';
const tenantSlugEnv = process.env.UNLIGHTHOUSE_TENANT_SLUG?.trim();

if (!email || !password) {
  console.error(
    'Missing UNLIGHTHOUSE_AUTH_EMAIL or UNLIGHTHOUSE_AUTH_PASSWORD.\n' +
      'Example:\n' +
      '  UNLIGHTHOUSE_AUTH_EMAIL=test@example.com UNLIGHTHOUSE_AUTH_PASSWORD=secret node scripts/unlighthouse-auth.mjs',
  );
  process.exit(1);
}

function normalizeApiV1Base(url) {
  const trimmed = url.replace(/\/$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
}

function normalizeApiOrigin(url) {
  return normalizeApiV1Base(url).replace(/\/api\/v1$/, '');
}

function parseAuthCookies(setCookieHeaders) {
  const cookies = [];
  for (const header of setCookieHeaders) {
    const [nameValue, ...attrs] = header.split(';').map((s) => s.trim());
    const eq = nameValue.indexOf('=');
    if (eq === -1) continue;
    const name = nameValue.slice(0, eq);
    const value = nameValue.slice(eq + 1);
    if (!['access_token', 'refresh_token', 'csrf_token', '_csrf'].includes(name)) continue;
    const cookie = { name, value, path: '/' };
    for (const attr of attrs) {
      const [k, ...rest] = attr.split('=');
      const key = k.trim().toLowerCase();
      const v = rest.join('=').trim();
      if (key === 'domain' && v) cookie.domain = v;
      if (key === 'path' && v) cookie.path = v;
    }
    cookies.push(cookie);
  }
  return cookies;
}

function apiCookieDomain(apiOrigin) {
  try {
    const host = new URL(apiOrigin).hostname;
    if (host === 'localhost' || host.endsWith('.localhost')) return 'localhost';
    if (host.endsWith('.paqadhr.com')) return '.paqadhr.com';
    return host;
  } catch {
    return 'localhost';
  }
}

function suggestSite(apiOrigin, tenantSlug) {
  if (process.env.UNLIGHTHOUSE_SITE?.trim()) return process.env.UNLIGHTHOUSE_SITE.trim();
  const isDev = apiOrigin.includes('api-dev');
  const isProd = apiOrigin.includes('api.paqadhr.com') && !isDev;
  if (isProd) return `https://${tenantSlug}.paqadhr.com`;
  if (isDev) return `https://${tenantSlug}.dev.paqadhr.com`;
  // Path-prefix on apex — cookies on localhost work for API on localhost:9001
  return `http://localhost:3000`;
}

const apiV1Base = normalizeApiV1Base(apiUrlRaw);
const apiOrigin = normalizeApiOrigin(apiUrlRaw);
const isSecure = apiOrigin.startsWith('https://');

console.log(`API: ${apiOrigin}`);
console.log(`Login as ${email}...`);

const loginRes = await fetch(`${apiV1Base}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, rememberMe: true }),
});

if (!loginRes.ok) {
  console.error(`Login failed ${loginRes.status}: ${await loginRes.text()}`);
  process.exit(1);
}

const setCookies = loginRes.headers.getSetCookie
  ? loginRes.headers.getSetCookie()
  : loginRes.headers.get('set-cookie')?.split(/,(?=\s*[^;]+=[^;]+)/)?.map((s) => s.trim()) ?? [];

const parsed = parseAuthCookies(setCookies);
if (parsed.length === 0) {
  console.error('No access_token/refresh_token in Set-Cookie. Headers:', setCookies);
  process.exit(1);
}

const domain = apiCookieDomain(apiOrigin);
const apiCookies = parsed.map((c) => ({
  name: c.name,
  value: c.value,
  domain: c.domain || domain,
  path: c.path || '/',
  httpOnly: true,
  secure: isSecure,
  sameSite: isSecure ? 'None' : 'Lax',
}));

let tenantSlug = tenantSlugEnv;
if (!tenantSlug) {
  try {
    const cookieHeader = parsed.map((c) => `${c.name}=${c.value}`).join('; ');
    const tenantsRes = await fetch(`${apiV1Base}/tenants`, {
      headers: { Cookie: cookieHeader },
    });
    if (tenantsRes.ok) {
      const data = await tenantsRes.json();
      const tenants = Array.isArray(data) ? data : data.tenants || data.data || [];
      const active = tenants.find((t) => t.isActive) || tenants[0];
      tenantSlug = active?.slug;
      if (tenantSlug) console.log(`Found tenant: ${tenantSlug}`);
    } else {
      console.warn(`Could not fetch tenants (${tenantsRes.status})`);
    }
  } catch (e) {
    console.warn('Tenant fetch failed:', e.message);
  }
}

if (!tenantSlug) {
  console.error('Set UNLIGHTHOUSE_TENANT_SLUG — needed to pick private URLs.');
  process.exit(1);
}

const site = suggestSite(apiOrigin, tenantSlug);
const webHost = new URL(site).hostname;

// Middleware reads tenant_slug on the web host (not httpOnly).
const webCookies = [
  {
    name: 'tenant_slug',
    value: tenantSlug,
    domain: webHost.endsWith('.paqadhr.com') ? '.paqadhr.com' : webHost,
    path: '/',
    httpOnly: false,
    secure: site.startsWith('https://'),
    sameSite: 'Lax',
  },
];

const state = {
  site,
  tenantSlug,
  cookies: [...apiCookies, ...webCookies],
};

const outPath = resolve('unlighthouse.cookies.json');
writeFileSync(outPath, JSON.stringify(state, null, 2));
console.log(`Saved auth state → ${outPath}`);
console.log(`Site: ${site}`);
console.log(`\nRun: pnpm unlighthouse:auth`);
console.log('(or UNLIGHTHOUSE_SITE=… pnpm unlighthouse to override site)');
