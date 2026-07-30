import assert from 'node:assert/strict';
import test from 'node:test';
import { getBreadcrumbs } from './breadcrumbs.ts';

test('settings routes append the active tab label to the breadcrumb trail', () => {
  assert.deepEqual(getBreadcrumbs('/pikolob/settings', 'Profile'), [
    { label: 'Dashboard', href: '/pikolob' },
    { label: 'Settings', href: '/pikolob/settings' },
    { label: 'Profile' },
  ]);
});

test('settings routes do not duplicate the settings label in breadcrumbs', () => {
  assert.deepEqual(getBreadcrumbs('/pikolob/settings', 'Settings'), [
    { label: 'Dashboard', href: '/pikolob' },
    { label: 'Settings' },
  ]);
});
