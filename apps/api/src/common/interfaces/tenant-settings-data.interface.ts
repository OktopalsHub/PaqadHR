import { PointsSettings } from "./points-settings.interface";
import { NotificationSettings } from "./notification-settings.interface";
import { ShoutoutSettings } from "./shoutout-settings.interface";
import { AttendanceSettings } from "./attendance-settings.interface";
import { GeneralSettings } from "./general-settings.interface";
import { EmployeeSettings } from "./employee-settings.interface";
import { HolidaySettings } from "./holiday-settings.interface";

export interface TenantSettingsData {
    points: PointsSettings;
    notifications: NotificationSettings;
    shoutouts: ShoutoutSettings;
    general: GeneralSettings;
    attendance: AttendanceSettings;
    employee: EmployeeSettings;
    holidays: HolidaySettings;
}
