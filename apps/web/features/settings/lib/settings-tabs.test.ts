import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAccessibleSettingsTabs,
  getVisibleSettingsTabs,
  resolveAccessibleSettingsTab,
  resolveSettingsTab,
  SETTINGS_TABS,
  shouldUseSettingsSidebar,
} from './settings-tabs.ts';

test('non-admin users only see the profile tab', () => {
  assert.deepEqual(getVisibleSettingsTabs(false), ['profile']);
});

test('admin users see all settings tabs', () => {
  assert.deepEqual(getVisibleSettingsTabs(true), [...SETTINGS_TABS]);
});

test('non-admin requests for admin tabs resolve back to profile', () => {
  assert.equal(resolveSettingsTab('billing', false), 'profile');
  assert.equal(resolveSettingsTab('integrations', false), 'profile');
});

test('admin requests keep the requested settings tab when valid', () => {
  assert.equal(resolveSettingsTab('billing', true), 'billing');
  assert.equal(resolveSettingsTab('profile', true), 'profile');
});

test('restricted settings tabs are hidden when the required entitlement is missing', () => {
  assert.deepEqual(
    getAccessibleSettingsTabs(true, {
      canAccessAttendance: false,
      canAccessIntegrations: false,
    }),
    ['profile', 'workspace', 'leave', 'holidays', 'notifications', 'billing'],
  );
});

test('restricted settings deep links resolve to the first accessible tab', () => {
  assert.equal(
    resolveAccessibleSettingsTab('shoutouts', true, {
      canAccessAttendance: true,
      canAccessIntegrations: false,
    }),
    'profile',
  );
  assert.equal(
    resolveAccessibleSettingsTab('attendance', true, {
      canAccessAttendance: false,
      canAccessIntegrations: true,
    }),
    'profile',
  );
});

test('invalid or missing tab values resolve to profile', () => {
  assert.equal(resolveSettingsTab(null, true), 'profile');
  assert.equal(resolveSettingsTab('unknown', true), 'profile');
});

test('app sidebar switches to settings navigation only on settings routes', () => {
  assert.equal(shouldUseSettingsSidebar('/pikolob/settings', '/pikolob/settings'), true);
  assert.equal(shouldUseSettingsSidebar('/pikolob/settings/advanced', '/pikolob/settings'), true);
  assert.equal(shouldUseSettingsSidebar('/pikolob/employees', '/pikolob/settings'), false);
});
