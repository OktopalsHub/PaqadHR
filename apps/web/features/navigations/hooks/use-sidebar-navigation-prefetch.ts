'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { resolveDateRange } from '@/features/attendance/lib/attendance-utils';
import { fetchTenantActivities } from '@/lib/api/activities';
import { fetchAnalyticsOverview } from '@/lib/api/analytics';
import { fetchMyAttendanceRecords, fetchTodayAttendance } from '@/lib/api/attendance';
import { fetchCalendarEvents } from '@/lib/api/calendar';
import { fetchDepartments } from '@/lib/api/departments';
import { fetchEmployees } from '@/lib/api/employees';
import { fetchLeaves, fetchMyLeaves } from '@/lib/api/leaves';
import { fetchPayrollRuns } from '@/lib/api/payroll';
import { fetchAllCandidates, fetchJobOpenings } from '@/lib/api/recruitment';
import { fetchShoutouts } from '@/lib/api/shoutouts';
import { hasDirectReports, isTenantAdmin } from '@/lib/auth/manager-access';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';
import type { NavItem } from '../constants/nav-items';

const PREFETCH_STALE_TIME_MS = 60_000;

export function useSidebarNavigationPrefetch() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenant, tenantId } = useTenant();

  return useCallback(
    (item: NavItem) => {
      router.prefetch(item.href);
      if (!tenantId) return;

      switch (item.segment) {
        case 'employees':
          void queryClient.prefetchQuery({
            queryKey: [...queryKeys.employees.all, tenantId],
            queryFn: fetchEmployees,
            staleTime: PREFETCH_STALE_TIME_MS,
          });
          void queryClient.prefetchQuery({
            queryKey: [...queryKeys.departments.all, tenantId],
            queryFn: fetchDepartments,
            staleTime: PREFETCH_STALE_TIME_MS,
          });
          break;
        case 'attendance': {
          const range = resolveDateRange('30d');
          const memberId = tenant?.member?.id;
          void queryClient.prefetchQuery({
            queryKey: [...queryKeys.attendance.today, tenantId],
            queryFn: fetchTodayAttendance,
            staleTime: PREFETCH_STALE_TIME_MS,
          });
          if (memberId) {
            void queryClient.prefetchQuery({
              queryKey: [
                ...queryKeys.attendance.myRecords,
                tenantId,
                memberId,
                range.from,
                range.to,
              ],
              queryFn: () => fetchMyAttendanceRecords(range.from, range.to, memberId),
              staleTime: PREFETCH_STALE_TIME_MS,
            });
          }
          break;
        }
        case 'calendar':
          void queryClient.prefetchQuery({
            queryKey: [...queryKeys.calendar.events, tenantId, undefined],
            queryFn: () => fetchCalendarEvents(),
            staleTime: PREFETCH_STALE_TIME_MS,
          });
          break;
        case 'leaves': {
          const employees = queryClient.getQueryData<{ id: string; reportsToId?: string }[]>([
            ...queryKeys.employees.all,
            tenantId,
          ]);
          const canViewTeamLeaves =
            isTenantAdmin(tenant?.member?.role) ||
            (tenant?.member?.id ? hasDirectReports(tenant.member.id, employees ?? []) : false);

          void queryClient.prefetchQuery({
            queryKey: [
              ...queryKeys.leaves.all,
              tenantId,
              canViewTeamLeaves ? 'team' : 'self',
              undefined,
            ],
            queryFn: canViewTeamLeaves ? fetchLeaves : fetchMyLeaves,
            staleTime: PREFETCH_STALE_TIME_MS,
          });
          break;
        }
        case 'payroll':
          void queryClient.prefetchQuery({
            queryKey: [...queryKeys.payroll.all, tenantId],
            queryFn: fetchPayrollRuns,
            staleTime: PREFETCH_STALE_TIME_MS,
          });
          break;
        case 'shoutouts':
          void queryClient.prefetchQuery({
            queryKey: [...queryKeys.shoutouts.all, tenantId],
            queryFn: () => fetchShoutouts({ limit: 50 }),
            staleTime: 30_000,
          });
          break;
        case 'recruitment':
          void queryClient.prefetchQuery({
            queryKey: [...queryKeys.recruitment.jobs, tenantId, ''],
            queryFn: () => fetchJobOpenings({ limit: 50 }),
            staleTime: PREFETCH_STALE_TIME_MS,
          });
          void queryClient.prefetchQuery({
            queryKey: [...queryKeys.recruitment.allCandidates, tenantId, undefined],
            queryFn: fetchAllCandidates,
            staleTime: PREFETCH_STALE_TIME_MS,
          });
          break;
        case 'analytics':
          void queryClient.prefetchQuery({
            queryKey: queryKeys.analytics.overview(tenantId),
            queryFn: fetchAnalyticsOverview,
            staleTime: PREFETCH_STALE_TIME_MS,
          });
          break;
        case 'activity':
          void queryClient.prefetchQuery({
            queryKey: [
              ...queryKeys.activities.list(tenantId),
              { page: 1, limit: 20 },
              { mild: undefined },
            ],
            queryFn: () => fetchTenantActivities({ page: 1, limit: 20 }),
            staleTime: 30_000,
          });
          break;
      }
    },
    [queryClient, router, tenant, tenantId],
  );
}
