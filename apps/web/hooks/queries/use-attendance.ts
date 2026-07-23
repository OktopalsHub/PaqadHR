'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useClockInEnabled } from '@/hooks/queries/use-tenant-settings';
import {
  approveAttendanceException,
  type ClockInInfo,
  clockIn,
  clockOut,
  createAttendanceException,
  deleteAttendance,
  fetchAttendanceExceptions,
  fetchAttendanceStats,
  fetchClockInInfo,
  fetchDailyReport,
  fetchEmployeeReport,
  fetchMonthlyReport,
  fetchMonthlyTimesheet,
  fetchMyAttendanceRecords,
  fetchSessionCount,
  fetchSessionLimit,
  fetchTeamAttendanceRecords,
  fetchTodayAttendance,
  rejectAttendanceException,
  updateAttendance,
} from '@/lib/api/attendance';
import { hasDirectReports, isTenantAdmin } from '@/lib/auth/manager-access';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';
import { useEmployees } from './use-employees';

function useCanViewTeamAttendance() {
  const { tenant } = useTenant();
  const { data: employees = [] } = useEmployees();
  const role = tenant?.member?.role;
  const viewerMemberId = tenant?.member?.id;

  if (isTenantAdmin(role)) {
    return true;
  }
  if (!viewerMemberId) {
    return false;
  }
  return hasDirectReports(viewerMemberId, employees);
}

export function useClockInInfo() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const { enabled: clockInEnabled, isLoading: settingsLoading } = useClockInEnabled();

  return useQuery({
    queryKey: [...queryKeys.attendance.clockInInfo, tenantId],
    queryFn: () => fetchClockInInfo(),
    enabled: !tenantLoading && !settingsLoading && Boolean(tenantId) && clockInEnabled,
    refetchInterval: clockInEnabled ? 60_000 : false,
  });
}

export function useMyAttendanceRecords(from: string, to: string) {
  const { tenantId, tenant, isLoading: tenantLoading } = useTenant();
  const memberId = tenant?.member?.id;

  return useQuery({
    queryKey: [...queryKeys.attendance.myRecords, tenantId, memberId, from, to],
    queryFn: () => fetchMyAttendanceRecords(from, to, memberId!),
    enabled: !tenantLoading && Boolean(tenantId && memberId),
  });
}

export function useMonthlyTimesheet(month: number, year: number, page = 1) {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const canViewTeam = useCanViewTeamAttendance();

  return useQuery({
    queryKey: [...queryKeys.attendance.monthly, tenantId, month, year, page],
    queryFn: () => fetchMonthlyTimesheet(month, year, page),
    enabled: !tenantLoading && Boolean(tenantId) && canViewTeam,
  });
}

export function useTeamAttendanceRecords(from: string, to: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const canViewTeam = useCanViewTeamAttendance();

  return useQuery({
    queryKey: [...queryKeys.attendance.teamRecords, tenantId, from, to],
    queryFn: () => fetchTeamAttendanceRecords(from, to),
    enabled: !tenantLoading && Boolean(tenantId) && canViewTeam,
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const clockInQueryKey = [...queryKeys.attendance.clockInInfo, tenantId];

  return useMutation({
    mutationFn: clockIn,
    onSuccess: (record) => {
      queryClient.setQueryData<ClockInInfo>(clockInQueryKey, (current) => {
        if (!current || !record.clockIn) {
          return current;
        }
        return {
          ...current,
          canClockIn: false,
          reason: 'Already clocked in',
          activeSession: {
            id: record.id,
            clockIn: record.clockIn,
            sessionNumber: record.sessionNumber,
          },
          currentSessions: current.currentSessions + 1,
        };
      });
      void queryClient.invalidateQueries({ queryKey: clockInQueryKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.myRecords });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.teamRecords });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.monthly });
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const clockInQueryKey = [...queryKeys.attendance.clockInInfo, tenantId];

  return useMutation({
    mutationFn: ({
      attendanceId,
      ...input
    }: {
      attendanceId: string;
      location?: string;
      notes?: string;
      clockOut?: string;
    }) => clockOut(attendanceId, input),
    onSuccess: () => {
      queryClient.setQueryData<ClockInInfo>(clockInQueryKey, (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          canClockIn: true,
          reason: 'Can clock in',
          activeSession: null,
        };
      });
      void queryClient.invalidateQueries({ queryKey: clockInQueryKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.myRecords });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.teamRecords });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.monthly });
    },
  });
}

export function useTodayAttendance() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.attendance.today, tenantId],
    queryFn: fetchTodayAttendance,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useAttendanceStats(startDate?: string, endDate?: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.attendance.stats, tenantId, startDate, endDate],
    queryFn: () => fetchAttendanceStats(startDate, endDate),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useAttendanceExceptions(filters?: {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.attendance.exceptions, tenantId, filters],
    queryFn: () => fetchAttendanceExceptions(filters),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useCreateAttendanceException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAttendanceException,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.exceptions });
    },
  });
}

export function useApproveAttendanceException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ exceptionId, comments }: { exceptionId: string; comments?: string }) =>
      approveAttendanceException(exceptionId, comments),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.exceptions });
    },
  });
}

export function useRejectAttendanceException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ exceptionId, comments }: { exceptionId: string; comments: string }) =>
      rejectAttendanceException(exceptionId, comments),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.exceptions });
    },
  });
}

export function useDailyReport(date?: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.attendance.dailyReport, tenantId, date],
    queryFn: () => fetchDailyReport(date),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useMonthlyReport(month: number, year: number) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.attendance.monthlyReport, tenantId, month, year],
    queryFn: () => fetchMonthlyReport(month, year),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useEmployeeReport(employeeId: string, startDate: string, endDate: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.attendance.monthlyReport, 'employee', employeeId, startDate, endDate],
    queryFn: () => fetchEmployeeReport(employeeId, startDate, endDate),
    enabled: !tenantLoading && Boolean(tenantId) && Boolean(employeeId),
  });
}

export function useUpdateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      attendanceId,
      input,
    }: {
      attendanceId: string;
      input: { status?: string; clockIn?: string; clockOut?: string; notes?: string };
    }) => updateAttendance(attendanceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.myRecords });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.teamRecords });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.monthly });
    },
  });
}

export function useDeleteAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.myRecords });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.teamRecords });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.monthly });
    },
  });
}

export function useSessionLimit() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.attendance.sessionLimit, tenantId],
    queryFn: fetchSessionLimit,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useSessionCount(date?: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.attendance.sessionCount, tenantId, date],
    queryFn: () => fetchSessionCount(date),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}
