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
  forgottenSession?: {
    id: string;
    date: string;
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
  input?: { location?: string; notes?: string; clockOut?: string },
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

export type TodayAttendance = {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  workHours: string | null;
  status: string;
  sessionStatus: string;
  sessionNumber: number;
};

export async function fetchTodayAttendance(): Promise<TodayAttendance[]> {
  const tenantId = await resolveTenantId();
  return apiClient<TodayAttendance[]>(tenantPath(tenantId, 'attendance/today'));
}

export type AttendanceStats = {
  totalMembers: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  averageWorkHours: number;
  attendanceRate: number;
};

export async function fetchAttendanceStats(
  startDate?: string,
  endDate?: string,
): Promise<AttendanceStats> {
  const tenantId = await resolveTenantId();
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const qs = params.toString();
  return apiClient<AttendanceStats>(tenantPath(tenantId, `attendance/stats${qs ? `?${qs}` : ''}`));
}

export type AttendanceException = {
  id: string;
  tenantMemberId: string;
  date: string;
  type: string;
  reason: string;
  status: string;
  reviewedBy?: string | null;
  reviewComments?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export async function fetchAttendanceExceptions(filters?: {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<AttendanceException[]> {
  const tenantId = await resolveTenantId();
  const params = new URLSearchParams();
  if (filters?.employeeId) params.set('employeeId', filters.employeeId);
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return apiClient<AttendanceException[]>(
    tenantPath(tenantId, `attendance/exceptions${qs ? `?${qs}` : ''}`),
  );
}

export async function createAttendanceException(input: {
  date: string;
  type: 'OVERTIME' | 'UNDERTIME' | 'ABSENCE' | 'LATE';
  reason: string;
}): Promise<AttendanceException> {
  const tenantId = await resolveTenantId();
  return apiClient<AttendanceException>(tenantPath(tenantId, 'attendance/exceptions'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function approveAttendanceException(
  exceptionId: string,
  comments?: string,
): Promise<AttendanceException> {
  const tenantId = await resolveTenantId();
  return apiClient<AttendanceException>(
    tenantPath(tenantId, `attendance/exceptions/${exceptionId}/approve`),
    {
      method: 'PATCH',
      body: JSON.stringify({ comments: comments ?? '' }),
    },
  );
}

export async function rejectAttendanceException(
  exceptionId: string,
  comments: string,
): Promise<AttendanceException> {
  const tenantId = await resolveTenantId();
  return apiClient<AttendanceException>(
    tenantPath(tenantId, `attendance/exceptions/${exceptionId}/reject`),
    {
      method: 'PATCH',
      body: JSON.stringify({ comments }),
    },
  );
}

export type DailyReportEntry = {
  memberId: string;
  memberName: string;
  status: string;
  clockIn: string | null;
  clockOut: string | null;
  workHours: string | null;
  sessions: number;
};

export async function fetchDailyReport(date?: string): Promise<DailyReportEntry[]> {
  const tenantId = await resolveTenantId();
  const params = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await apiClient<{
    date: string;
    attendances: Array<{
      id: string;
      status: string;
      clockIn: string | null;
      clockOut: string | null;
      workHours: string | null;
      sessionNumber: number;
      member?: {
        id: string;
        firstName?: string | null;
        lastName?: string | null;
      } | null;
    }>;
  }>(tenantPath(tenantId, `attendance/reports/daily${params}`));
  return res.attendances.map((a) => ({
    memberId: a.member?.id ?? '',
    memberName: [a.member?.firstName, a.member?.lastName].filter(Boolean).join(' ') || '—',
    status: a.status,
    clockIn: a.clockIn,
    clockOut: a.clockOut,
    workHours: a.workHours,
    sessions: a.sessionNumber,
  }));
}

export type MonthlyReportEntry = {
  memberId: string;
  memberName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  workHours: number;
  attendanceRate: number;
};

export async function fetchMonthlyReport(
  month: number,
  year: number,
): Promise<MonthlyReportEntry[]> {
  const tenantId = await resolveTenantId();
  const params = new URLSearchParams({ month: String(month), year: String(year) });
  const res = await apiClient<{
    month: number;
    year: number;
    attendances: Array<{
      id: string;
      tenantMemberId: string;
      status: string;
      workHours: string | null;
      tenantMember?: {
        id: string;
        firstName?: string | null;
        lastName?: string | null;
      } | null;
    }>;
  }>(tenantPath(tenantId, `attendance/reports/monthly?${params.toString()}`));

  const byMember = new Map<
    string,
    { name: string; present: number; absent: number; late: number; hours: number; total: number }
  >();
  for (const a of res.attendances) {
    const id = a.tenantMemberId;
    if (!byMember.has(id)) {
      const m = a.tenantMember;
      byMember.set(id, {
        name: [m?.firstName, m?.lastName].filter(Boolean).join(' ') || '—',
        present: 0,
        absent: 0,
        late: 0,
        hours: 0,
        total: 0,
      });
    }
    const entry = byMember.get(id)!;
    entry.total += 1;
    if (a.status === 'PRESENT') entry.present += 1;
    else if (a.status === 'ABSENT') entry.absent += 1;
    else if (a.status === 'LATE') entry.late += 1;
    entry.hours += parseFloat(a.workHours ?? '0') || 0;
  }

  return Array.from(byMember.entries()).map(([memberId, s]) => ({
    memberId,
    memberName: s.name,
    totalDays: s.total,
    presentDays: s.present,
    absentDays: s.absent,
    lateDays: s.late,
    workHours: Math.round(s.hours * 100) / 100,
    attendanceRate: s.total > 0 ? Math.round((s.present / s.total) * 10000) / 100 : 0,
  }));
}

export async function fetchEmployeeReport(
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<AttendanceRecord[]> {
  const tenantId = await resolveTenantId();
  const params = new URLSearchParams({ startDate, endDate });
  return apiClient<AttendanceRecord[]>(
    tenantPath(tenantId, `attendance/reports/employee/${employeeId}?${params.toString()}`),
  );
}

export async function createManualAttendance(input: {
  tenantMemberId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  status: string;
  location?: string;
  notes?: string;
}): Promise<AttendanceRecord> {
  const tenantId = await resolveTenantId();
  return apiClient<AttendanceRecord>(tenantPath(tenantId, 'attendance/manual'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAttendance(
  attendanceId: string,
  input: { status?: string; clockIn?: string; clockOut?: string; notes?: string },
): Promise<AttendanceRecord> {
  const tenantId = await resolveTenantId();
  return apiClient<AttendanceRecord>(tenantPath(tenantId, `attendance/${attendanceId}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteAttendance(attendanceId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `attendance/${attendanceId}`), { method: 'DELETE' });
}

export async function fetchSessionLimit(): Promise<{ maxSessionsPerDay: number }> {
  const tenantId = await resolveTenantId();
  return apiClient<{ maxSessionsPerDay: number }>(tenantPath(tenantId, 'attendance/session-limit'));
}

export async function fetchSessionCount(date?: string): Promise<{ sessionCount: number }> {
  const tenantId = await resolveTenantId();
  const params = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiClient<{ sessionCount: number }>(
    tenantPath(tenantId, `attendance/session-count${params}`),
  );
}
