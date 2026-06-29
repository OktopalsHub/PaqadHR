import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export type ClockInInfo = {
  date: string;
  status: string;
  clockInEnabled: boolean;
  canClockIn: boolean;
  reason: string;
  isWeekend: boolean;
  isOnLeave: boolean;
  leaveType?: string;
  currentSessions: number;
  maxSessions: number;
  activeSession: {
    id: string;
    clockIn: string;
    sessionNumber: number;
  } | null;
  existingAttendance: Array<{
    id: string;
    clockIn: string | null;
    clockOut: string | null;
    sessionNumber: number;
    sessionStatus: string;
    workHours: string | null;
  }>;
};

export type AttendanceRecord = {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  workHours: string | null;
  status: string;
  sessionStatus: string;
  sessionNumber: number;
  notes?: string | null;
  location?: string | null;
};

export async function fetchClockInInfo(date?: string): Promise<ClockInInfo> {
  const tenantId = await resolveTenantId();
  const params = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiClient<ClockInInfo>(tenantPath(tenantId, `attendance/clock-in-info${params}`));
}

export async function clockIn(input?: {
  location?: string;
  notes?: string;
}): Promise<AttendanceRecord> {
  const tenantId = await resolveTenantId();
  return apiClient<AttendanceRecord>(tenantPath(tenantId, 'attendance/clock-in'), {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  });
}

export async function clockOut(
  attendanceId: string,
  input?: { location?: string; notes?: string },
): Promise<AttendanceRecord> {
  const tenantId = await resolveTenantId();
  return apiClient<AttendanceRecord>(tenantPath(tenantId, `attendance/clock-out/${attendanceId}`), {
    method: 'PATCH',
    body: JSON.stringify(input ?? {}),
  });
}

type RawAttendanceRecord = AttendanceRecord & {
  member?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    employeeNumber?: string | null;
  } | null;
};

function mapAttendanceRecord(raw: RawAttendanceRecord): AttendanceRecord {
  return {
    id: raw.id,
    date: raw.date,
    clockIn: raw.clockIn ?? null,
    clockOut: raw.clockOut ?? null,
    workHours: raw.workHours ?? null,
    status: raw.status,
    sessionStatus: raw.sessionStatus,
    sessionNumber: raw.sessionNumber,
    notes: raw.notes ?? null,
    location: raw.location ?? null,
  };
}

export type TeamAttendanceRecord = AttendanceRecord & {
  member: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    employeeNumber?: string | null;
  } | null;
};

export async function fetchMyAttendanceRecords(
  from: string,
  to: string,
  employeeId: string,
): Promise<AttendanceRecord[]> {
  const tenantId = await resolveTenantId();
  const params = new URLSearchParams({ startDate: from, endDate: to, employeeId });
  const records = await apiClient<RawAttendanceRecord[]>(
    tenantPath(tenantId, `attendance?${params.toString()}`),
  );
  return records.map(mapAttendanceRecord);
}

export async function fetchTeamAttendanceRecords(
  from: string,
  to: string,
): Promise<TeamAttendanceRecord[]> {
  const tenantId = await resolveTenantId();
  const params = new URLSearchParams({ startDate: from, endDate: to });
  const records = await apiClient<RawAttendanceRecord[]>(
    tenantPath(tenantId, `attendance?${params.toString()}`),
  );
  return records.map((raw) => ({
    ...mapAttendanceRecord(raw),
    member: raw.member ?? null,
  }));
}

export type MonthlyTimesheetMember = {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber?: string | null;
    email?: string | null;
  };
  statistics: {
    totalDays: number;
    workingDays: number;
    presentDays: number;
    absentDays: number;
    weekendDays: number;
    leaveDays: number;
    attendanceRate: number;
  };
  dailyAttendance: Array<{
    date: string;
    day: number;
    status: string;
    isWeekend?: boolean;
    isOnLeave?: boolean;
    leaveType?: string;
    attendance: Array<{
      id?: string;
      clockIn: string | null;
      clockOut: string | null;
      workHours: string | null;
      sessionNumber?: number;
      sessionStatus?: string;
    }>;
  }>;
};

export type MonthlyTimesheetResponse = {
  month: number;
  year: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
  summary?: {
    totalMembers: number;
    daysInMonth: number;
    workingDays: number;
  };
  members: MonthlyTimesheetMember[];
};

export async function fetchMonthlyTimesheet(
  month: number,
  year: number,
  page = 1,
): Promise<MonthlyTimesheetResponse> {
  const tenantId = await resolveTenantId();
  const params = new URLSearchParams({
    view: 'monthly',
    month: String(month),
    year: String(year),
    page: String(page),
    limit: '20',
  });
  return apiClient<MonthlyTimesheetResponse>(
    tenantPath(tenantId, `attendance?${params.toString()}`),
  );
}
