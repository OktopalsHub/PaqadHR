'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { fetchAnalyticsOverview } from '@/lib/api/analytics';
import { fetchCalendarEvents } from '@/lib/api/calendar';
import { fetchDepartments } from '@/lib/api/departments';
import { fetchEmployees } from '@/lib/api/employees';
import { fetchLeaves, fetchMyLeaves } from '@/lib/api/leaves';
import { fetchPayrollRuns } from '@/lib/api/payroll';
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
        case 'analytics':
          void queryClient.prefetchQuery({
            queryKey: [...queryKeys.analytics.overview, tenantId],
            queryFn: fetchAnalyticsOverview,
            staleTime: PREFETCH_STALE_TIME_MS,
          });
          break;
      }
    },
    [queryClient, router, tenant, tenantId],
  );
}
