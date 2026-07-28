import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getVisibleSettingsTabs,
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

test('invalid or missing tab values resolve to profile', () => {
  assert.equal(resolveSettingsTab(null, true), 'profile');
  assert.equal(resolveSettingsTab('unknown', true), 'profile');
});

test('app sidebar switches to settings navigation only on settings routes', () => {
  assert.equal(shouldUseSettingsSidebar('/pikolob/settings', '/pikolob/settings'), true);
  assert.equal(shouldUseSettingsSidebar('/pikolob/settings/advanced', '/pikolob/settings'), true);
  assert.equal(shouldUseSettingsSidebar('/pikolob/employees', '/pikolob/settings'), false);
});
