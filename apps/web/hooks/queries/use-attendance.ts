'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clockIn,
  clockOut,
  fetchClockInInfo,
  fetchMonthlyTimesheet,
  fetchMyAttendanceRecords,
  fetchTeamAttendanceRecords,
  type ClockInInfo,
} from '@/lib/api/attendance';
import { hasDirectReports, isTenantAdmin } from '@/lib/auth/manager-access';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';
import { useClockInEnabled } from '@/hooks/queries/use-tenant-settings';
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
    mutationFn: ({ attendanceId, ...input }: { attendanceId: string; location?: string; notes?: string }) =>
      clockOut(attendanceId, input),
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
