import type { AttendanceSettings } from './attendance-settings.interface';
import type { EmployeeSettings } from './employee-settings.interface';
import type { GeneralSettings } from './general-settings.interface';
import type { HolidaySettings } from './holiday-settings.interface';
import type { NotificationSettings } from './notification-settings.interface';
import type { PointsSettings } from './points-settings.interface';
import type { ShoutoutSettings } from './shoutout-settings.interface';

export interface PartialTenantSettingsData {
  points?: Partial<PointsSettings>;
  notifications?: Partial<NotificationSettings>;
  shoutouts?: Partial<ShoutoutSettings>;
  general?: Partial<GeneralSettings>;
  attendance?: Partial<AttendanceSettings>;
  employee?: Partial<EmployeeSettings>;
  holidays?: Partial<HolidaySettings>;
}
