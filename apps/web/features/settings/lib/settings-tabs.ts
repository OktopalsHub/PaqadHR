export const SETTINGS_TABS = [
  'profile',
  'workspace',
  'leave',
  'shoutouts',
  'rewards',
  'holidays',
  'notifications',
  'attendance',
  'billing',
  'integrations',
  'activities',
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const ADMIN_SETTINGS_TABS: SettingsTab[] = [
  'workspace',
  'leave',
  'shoutouts',
  'rewards',
  'holidays',
  'notifications',
  'attendance',
  'billing',
  'integrations',
  'activities',
];

export function isSettingsTab(value: string | null | undefined): value is SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab);
}

export function settingsTabHref(settingsPath: string, tab: SettingsTab): string {
  return `${settingsPath}?tab=${tab}`;
}
