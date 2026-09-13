import type { LeaveService } from '../../leave/leave.service';
import type { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import type { AttendanceRepository } from '../repositories/attendance.repository';
import type { DepartmentUtils } from '../utils/department.utils';
import { AttendanceReportService } from './attendance-report.service';

describe('AttendanceReportService', () => {
  it('returns monthly entries with structured member, day, and pagination data for the timesheet', async () => {
    const attendanceRepo = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as AttendanceRepository;
    const tenantMembersService = {
      getTenantMembers: jest.fn().mockResolvedValue([
        {
          id: 'member-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          employeeNumber: 'EMP-001',
          isActive: true,
        },
      ]),
    } as unknown as TenantMembersService;
    const tenantSettingsService = {
      getTenantSettings: jest.fn().mockResolvedValue({
        settings: { attendance: { weekends: [0, 6] } },
      }),
    } as unknown as TenantSettingsService;
    const leaveService = {
      getLeavesByMember: jest.fn().mockResolvedValue({ records: [] }),
    } as unknown as LeaveService;
    const departmentUtils = {
      getDepartmentsByMemberIds: jest.fn().mockResolvedValue(new Map()),
      formatDepartmentResponse: jest.fn().mockReturnValue(null),
    } as unknown as DepartmentUtils;
    const service = new AttendanceReportService(
      attendanceRepo,
      tenantMembersService,
      tenantSettingsService,
      leaveService,
      departmentUtils,
    );

    const result = await service.getMonthlyForAllMembers('tenant-1', 2, 2024);

    expect(result.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }),
    );
    expect(result.members[0]).toEqual(
      expect.objectContaining({
        member: {
          id: 'member-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          employeeNumber: 'EMP-001',
        },
        memberId: 'member-1',
        statistics: expect.objectContaining({ totalDays: 29 }),
      }),
    );
    expect(result.members[0].dailyAttendance[0]).toEqual(
      expect.objectContaining({ day: 1, attendance: [] }),
    );
  });
});
