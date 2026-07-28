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
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const SETTINGS_TAB_LABELS: Record<SettingsTab, string> = {
  profile: 'Profile',
  workspace: 'Workspace',
  leave: 'Leave',
  shoutouts: 'Shoutouts',
  rewards: 'Rewards',
  holidays: 'Holidays',
  notifications: 'Notifications',
  attendance: 'Attendance',
  billing: 'Billing',
  integrations: 'Integrations',
};

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
];

export function isSettingsTab(value: string | null | undefined): value is SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab);
}

export function getVisibleSettingsTabs(isAdmin: boolean): SettingsTab[] {
  return isAdmin ? [...SETTINGS_TABS] : ['profile'];
}

export function settingsTabHref(settingsPath: string, tab: SettingsTab): string {
  return `${settingsPath}?tab=${tab}`;
}
