import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { MARKETING_PAGES } from '@/lib/constants/marketing-pages';
import { middleware } from './middleware.ts';

function requestFor(pathname: string): NextRequest {
  return new NextRequest(new URL(`https://paqadhr.com${pathname}`), {
    headers: { host: 'paqadhr.com' },
  });
}

/**
 * Stub the workspace lookup the middleware makes before redirecting an apex
 * path to a tenant host. `slugs` are the workspaces that exist.
 */
function stubWorkspaceLookup(slugs: string[]): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(typeof input === 'object' && 'url' in input ? input.url : input);
    const slug = url.split('/tenants/slug/')[1]?.split('?')[0] ?? '';
    return new Response(JSON.stringify({ slug }), {
      status: slugs.includes(slug) ? 200 : 404,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test('missing asset paths return 404 instead of the tenant app shell', async () => {
  const response = await middleware(requestFor('/missing-asset.png'));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('known static files and real pages are not treated as missing assets', async () => {
  for (const pathname of ['/icon.png', '/robots.txt', '/sitemap.xml', '/llms.txt', '/signin']) {
    const response = await middleware(requestFor(pathname));

    assert.notEqual(response.status, 404, `${pathname} should not 404`);
  }
});

test('reserved tenant slugs on the apex 404 instead of throwing a 500', async () => {
  const previous = process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
  process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = 'true';
  try {
    // Every one of these is a reserved tenant slug (so buildTenantHost() throws) but not a
    // page, which used to surface as an uncaught "Reserved tenant slug" -> HTTP 500.
    for (const pathname of ['/blog', '/careers', '/company', '/legal', '/recruitment']) {
      const response = await middleware(requestFor(pathname));
      assert.equal(response.status, 404, `${pathname} should be 404`);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
    else process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = previous;
  }
});

test('reserved route segments are not redirected to a tenant host', async () => {
  const previous = process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
  process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = 'true';
  try {
    const response = await middleware(requestFor('/pricing'));
    assert.equal(response.status, 200, '/pricing must render, not redirect');
    assert.equal(response.headers.get('location'), null);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
    else process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = previous;
  }
});

test('legacy path redirects stay out of the index', async () => {
  const previous = process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
  process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = 'true';
  const restoreFetch = stubWorkspaceLookup(['acme']);
  try {
    const response = await middleware(requestFor('/acme/payroll'));
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://acme.paqadhr.com/payroll');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  } finally {
    restoreFetch();
    if (previous === undefined) delete process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
    else process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = previous;
  }
});

test('a slug that was never a workspace answers 404 instead of an empty workspace shell', async () => {
  const previous = process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
  process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = 'true';
  const restoreFetch = stubWorkspaceLookup(['acme']);
  try {
    const response = await middleware(requestFor('/not-a-workspace'));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  } finally {
    restoreFetch();
    if (previous === undefined) delete process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
    else process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = previous;
  }
});

test('a workspace lookup that cannot be answered keeps the tenant redirect', async () => {
  const previous = process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
  process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = 'true';
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('api unreachable');
  }) as typeof fetch;
  try {
    const response = await middleware(requestFor('/acme/payroll'));
    assert.equal(response.status, 301);
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
    else process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = previous;
  }
});

test('every marketing page survives the tenant redirect', async () => {
  const previous = process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
  process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = 'true';
  const restoreFetch = stubWorkspaceLookup([]);
  try {
    // Marketing paths are also reserved tenant slugs, so a missing entry in
    // RESERVED_ROUTE_SEGMENTS turns a live page into a 404 at the edge.
    for (const page of MARKETING_PAGES) {
      const response = await middleware(requestFor(page.path));
      assert.notEqual(response.status, 404, `${page.path} must not 404`);
      assert.notEqual(response.status, 301, `${page.path} must not redirect to a tenant`);
    }
  } finally {
    restoreFetch();
    if (previous === undefined) delete process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
    else process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = previous;
  }
});
