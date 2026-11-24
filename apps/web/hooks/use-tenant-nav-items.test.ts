import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { NavItem } from '@/features/navigations/constants/nav-items';

import { filterNavItemsByRole } from './use-tenant-nav-items';

const items = ['dashboard', 'employees', 'payroll', 'recruitment', 'analytics', 'logs'].map(
  (segment) => ({ segment, href: `/t/${segment}`, label: segment }) as unknown as NavItem,
);
const segments = (list: NavItem[]) => list.map((item) => item.segment);

describe('filterNavItemsByRole', () => {
  for (const role of ['owner', 'admin', 'ADMIN']) {
    it(`shows everything to ${role}`, () => {
      assert.equal(filterNavItemsByRole(items, role).length, 6);
    });
  }

  for (const role of ['member', 'manager', undefined, null, '']) {
    it(`hides admin pages from ${String(role)}, including before the role has loaded`, () => {
      assert.deepEqual(segments(filterNavItemsByRole(items, role)), ['dashboard', 'employees']);
    });
  }
});
