import { Injectable } from '@nestjs/common';
import { LeaveService } from '../../leave/leave.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';

@Injectable()
export class AttendanceEligibilityService {
  constructor(
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly leaveService: LeaveService,
  ) {}

  formatDurationToHHMMSS(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  async getTenantLocalDate(tenantId: string, date = new Date()): Promise<Date> {
    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const timezone = settings.settings.general?.timezone || 'UTC';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(
      Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)),
    );
  }

  async isClockInEnabled(tenantId: string): Promise<boolean> {
    try {
      const s = await this.tenantSettingsService.getTenantSettings(tenantId);
      return s.settings.attendance?.clockInEnabled === true;
    } catch {
      return false;
    }
  }

  async isWeekend(tenantId: string, date: Date): Promise<boolean> {
    try {
      const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const timezone = settings.settings.general?.timezone || 'UTC';
      const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
      }).format(date);
      const weekdayNumber = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
      return (settings.settings.attendance?.weekends || [0, 6]).includes(weekdayNumber);
    } catch {
      return [0, 6].includes(date.getUTCDay());
    }
  }

  async isOnLeave(
    tenantId: string,
    memberId: string,
    date: Date,
  ): Promise<{ isOnLeave: boolean; leaveType?: string }> {
    try {
      const leaves = await this.leaveService.getLeavesByMember(tenantId, memberId, {
        page: 1,
        limit: 100,
      });
      for (const l of leaves.records) {
        if (l.status === 'APPROVED' && date >= new Date(l.startDate) && date <= new Date(l.endDate))
          return { isOnLeave: true, leaveType: l.leaveType?.name };
      }
      return { isOnLeave: false };
    } catch {
      return { isOnLeave: false };
    }
  }
}
