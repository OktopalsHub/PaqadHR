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

test('missing asset paths return 404 instead of the tenant app shell', () => {
  const response = middleware(requestFor('/missing-asset.png'));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('known static files and real pages are not treated as missing assets', () => {
  for (const pathname of ['/icon.png', '/robots.txt', '/sitemap.xml', '/llms.txt', '/signin']) {
    const response = middleware(requestFor(pathname));

    assert.notEqual(response.status, 404, `${pathname} should not 404`);
  }
});

test('reserved tenant slugs on the apex 404 instead of throwing a 500', () => {
  const previous = process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
  process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = 'true';
  try {
    // Every one of these is a reserved tenant slug (so buildTenantHost() throws) but not a
    // page, which used to surface as an uncaught "Reserved tenant slug" -> HTTP 500.
    for (const pathname of ['/blog', '/careers', '/company', '/legal', '/recruitment']) {
      const response = middleware(requestFor(pathname));
      assert.equal(response.status, 404, `${pathname} should be 404`);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
    else process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = previous;
  }
});

test('reserved route segments are not redirected to a tenant host', () => {
  const previous = process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
  process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = 'true';
  try {
    const response = middleware(requestFor('/pricing'));
    assert.equal(response.status, 200, '/pricing must render, not redirect');
    assert.equal(response.headers.get('location'), null);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
    else process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = previous;
  }
});

test('legacy path redirects stay out of the index', () => {
  const previous = process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
  process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = 'true';
  try {
    const response = middleware(requestFor('/acme/payroll'));
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://acme.paqadhr.com/payroll');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
    else process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = previous;
  }
});

test('every marketing page survives the tenant redirect', () => {
  const previous = process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
  process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = 'true';
  try {
    // Marketing paths are also reserved tenant slugs, so a missing entry in
    // RESERVED_ROUTE_SEGMENTS turns a live page into a 404 at the edge.
    for (const page of MARKETING_PAGES) {
      const response = middleware(requestFor(page.path));
      assert.notEqual(response.status, 404, `${page.path} must not 404`);
      assert.notEqual(response.status, 301, `${page.path} must not redirect to a tenant`);
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS;
    else process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS = previous;
  }
});
