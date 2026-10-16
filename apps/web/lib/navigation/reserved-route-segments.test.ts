import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { RESERVED_ROUTE_SEGMENTS } from '../constants/reserved-tenant-slugs.ts';
import { getTenantSlugFromPath } from './tenant-routes.ts';

const appDir = fileURLToPath(new URL('../../app/', import.meta.url));

/**
 * Collects every static first path segment served by the app, expanding route
 * groups like `(root)` and ignoring dynamic (`[slug]`) and private (`_foo`)
 * directories. These are the segments the middleware would otherwise treat as
 * a tenant slug on the apex host.
 */
function staticTopLevelSegments(dir: string): string[] {
  const segments: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (!statSync(join(dir, entry)).isDirectory()) continue;
    if (entry.startsWith('(') && entry.endsWith(')')) {
      segments.push(...staticTopLevelSegments(join(dir, entry)));
      continue;
    }
    if (entry.startsWith('[') || entry.startsWith('_')) continue;
    segments.push(entry);
  }
  return segments;
}

test('every static top-level route is reserved against tenant-slug shadowing', () => {
  const unreserved = staticTopLevelSegments(appDir).filter(
    (segment) => !RESERVED_ROUTE_SEGMENTS.has(segment),
  );
  assert.deepEqual(
    unreserved,
    [],
    `These top-level routes are missing from RESERVED_ROUTE_SEGMENTS, so the middleware would 301 them to <segment>.<domain> (no certificate): ${unreserved.join(', ')}`,
  );
});

test('oauth completion route stays on the apex origin', () => {
  assert.equal(RESERVED_ROUTE_SEGMENTS.has('google'), true);
});

test('real app routes are never parsed as tenant slugs', () => {
  assert.equal(getTenantSlugFromPath('/google/complete'), null);
  assert.equal(getTenantSlugFromPath('/cookies'), null);
  assert.equal(getTenantSlugFromPath('/terms'), null);
  assert.equal(getTenantSlugFromPath('/privacy'), null);
  // A genuine legacy path-based tenant URL must still resolve.
  assert.equal(getTenantSlugFromPath('/acme/dashboard'), 'acme');
});
