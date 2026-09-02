import assert from 'node:assert/strict';
import test from 'node:test';
import type { Tenant } from '@/lib/schemas/tenant';
import { resolvePostAuthHref } from './resolve-post-auth-href.ts';

function workspace(overrides: Partial<Tenant> & Pick<Tenant, 'id' | 'slug'>): Tenant {
  return {
    id: overrides.id,
    slug: overrides.slug,
    name: overrides.name ?? overrides.slug,
    isActive: overrides.isActive ?? true,
    needsPayment: overrides.needsPayment,
  };
}

test('resolvePostAuthHref routes unpaid workspaces to subscribe without billing-status calls', async () => {
  const href = await resolvePostAuthHref({
    tenants: [
      workspace({ id: 'tenant-1', slug: 'unpaid', needsPayment: true }),
      workspace({ id: 'tenant-2', slug: 'paid', needsPayment: false }),
    ],
    paymentsEnabled: true,
  });

  assert.match(href, /\/paid(\/|$|\?)/);
});

test('resolvePostAuthHref sends all-unpaid users to subscribe', async () => {
  const href = await resolvePostAuthHref({
    tenants: [workspace({ id: 'tenant-1', slug: 'unpaid', needsPayment: true })],
    paymentsEnabled: true,
  });

  assert.match(href, /\/subscribe/);
});

test('resolvePostAuthHref ignores needsPayment when payments are disabled', async () => {
  const href = await resolvePostAuthHref({
    tenants: [workspace({ id: 'tenant-1', slug: 'workspace', needsPayment: true })],
    paymentsEnabled: false,
  });

  assert.match(href, /\/workspace(\/|$|\?)/);
});
