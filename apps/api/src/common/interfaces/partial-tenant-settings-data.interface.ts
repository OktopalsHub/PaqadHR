import { PointsSettings } from "./points-settings.interface";
import { NotificationSettings } from "./notification-settings.interface";
import { ShoutoutSettings } from "./shoutout-settings.interface";
import { AttendanceSettings } from "./attendance-settings.interface";
import { GeneralSettings } from "./general-settings.interface";
import { EmployeeSettings } from "./employee-settings.interface";
import { HolidaySettings } from "./holiday-settings.interface";

export interface PartialTenantSettingsData {
    points?: Partial<PointsSettings>;
    notifications?: Partial<NotificationSettings>;
    shoutouts?: Partial<ShoutoutSettings>;
    general?: Partial<GeneralSettings>;
    attendance?: Partial<AttendanceSettings>;
    employee?: Partial<EmployeeSettings>;
    holidays?: Partial<HolidaySettings>;
}
