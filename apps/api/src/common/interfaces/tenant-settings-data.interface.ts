import type { AttendanceSettings } from './attendance-settings.interface';
import type { BillingSettings } from './billing-settings.interface';
import type { EmployeeSettings } from './employee-settings.interface';
import type { GeneralSettings } from './general-settings.interface';
import type { HolidaySettings } from './holiday-settings.interface';
import type { NotificationSettings } from './notification-settings.interface';
import type { PointsSettings } from './points-settings.interface';
import type { RewardsSettings } from './rewards-settings.interface';
import type { ShoutoutSettings } from './shoutout-settings.interface';

export interface TenantSettingsData {
  points: PointsSettings;
  notifications: NotificationSettings;
  shoutouts: ShoutoutSettings;
  general: GeneralSettings;
  attendance: AttendanceSettings;
  employee: EmployeeSettings;
  holidays: HolidaySettings;
  billing: BillingSettings;
  rewards?: RewardsSettings;
}

