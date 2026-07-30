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

export type SettingsTabAvailability = {
  canAccessAttendance: boolean;
  canAccessIntegrations: boolean;
};

const DEFAULT_SETTINGS_TAB_AVAILABILITY: SettingsTabAvailability = {
  canAccessAttendance: true,
  canAccessIntegrations: true,
};

export function isSettingsTab(value: string | null | undefined): value is SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab);
}

export function getVisibleSettingsTabs(isAdmin: boolean): SettingsTab[] {
  return isAdmin ? [...SETTINGS_TABS] : ['profile'];
}

function canAccessSettingsTab(
  tab: SettingsTab,
  availability: SettingsTabAvailability = DEFAULT_SETTINGS_TAB_AVAILABILITY,
) {
  if (tab === 'attendance') {
    return availability.canAccessAttendance;
  }

  if (tab === 'shoutouts' || tab === 'rewards' || tab === 'integrations') {
    return availability.canAccessIntegrations;
  }

  return true;
}

export function getAccessibleSettingsTabs(
  isAdmin: boolean,
  availability: SettingsTabAvailability = DEFAULT_SETTINGS_TAB_AVAILABILITY,
): SettingsTab[] {
  return getVisibleSettingsTabs(isAdmin).filter((tab) => canAccessSettingsTab(tab, availability));
}

export function resolveSettingsTab(
  requestedTab: string | null | undefined,
  isAdmin: boolean,
): SettingsTab {
  if (isSettingsTab(requestedTab)) {
    if (!isAdmin && ADMIN_SETTINGS_TABS.includes(requestedTab)) {
      return 'profile';
    }
    return requestedTab;
  }

  return 'profile';
}

export function resolveAccessibleSettingsTab(
  requestedTab: string | null | undefined,
  isAdmin: boolean,
  availability: SettingsTabAvailability = DEFAULT_SETTINGS_TAB_AVAILABILITY,
): SettingsTab {
  const visibleTab = resolveSettingsTab(requestedTab, isAdmin);
  if (canAccessSettingsTab(visibleTab, availability)) {
    return visibleTab;
  }

  return getAccessibleSettingsTabs(isAdmin, availability)[0] ?? 'profile';
}

export function shouldUseSettingsSidebar(pathname: string, settingsHref: string): boolean {
  return pathname.startsWith(settingsHref);
}

export function settingsTabHref(settingsPath: string, tab: SettingsTab): string {
  return `${settingsPath}?tab=${tab}`;
}
