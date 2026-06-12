import {
  Column,
  Entity,
  Index
} from 'typeorm';
import { PointsSettings } from "../../../../common/interfaces/points-settings.interface";
import { NotificationSettings } from "../../../../common/interfaces/notification-settings.interface";
import { ShoutoutSettings } from "../../../../common/interfaces/shoutout-settings.interface";
import { AttendanceSettings } from "../../../../common/interfaces/attendance-settings.interface";
import { GeneralSettings } from "../../../../common/interfaces/general-settings.interface";
import { EmployeeSettings } from "../../../../common/interfaces/employee-settings.interface";
import { Holiday } from "../../../../common/interfaces/holiday.interface";
import { HolidaySettings } from "../../../../common/interfaces/holiday-settings.interface";
import { TenantSettingsData } from "../../../../common/interfaces/tenant-settings-data.interface";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity('tenant_settings')
@Index(['tenantId'], { unique: true })
export class TenantSettings extends BaseEntity {
  @Column('uuid')
  tenantId: string;
  @Column('jsonb')
  settings: TenantSettingsData;
}
