'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addCustomHoliday,
  assignPointsToAll,
  fetchHolidaySettings,
  fetchMembersPoints,
  fetchSupportedHolidayCountries,
  fetchTenantSettings,
  patchTenantSettings,
  removeCustomHoliday,
  type TenantSettingsData,
  updateHolidaySettings,
} from '@/lib/api/tenant-settings';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';
import {
  paymentMethodCurrenciesQueryKey,
  shouldInvalidatePaymentMethodCurrencies,
} from './tenant-settings-invalidation';

export function useTenantSettings() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  return useQuery({
    queryKey: [...queryKeys.settings.tenant, tenantId],
    queryFn: fetchTenantSettings,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function usePatchTenantSettings() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: (patch: Partial<TenantSettingsData>) => patchTenantSettings(patch),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.settings.tenant, tenantId] });
      if (variables.attendance !== undefined) {
        void queryClient.invalidateQueries({
          queryKey: [...queryKeys.attendance.clockInInfo, tenantId],
        });
      }
      if (shouldInvalidatePaymentMethodCurrencies(variables)) {
        void queryClient.invalidateQueries({
          queryKey: paymentMethodCurrenciesQueryKey(tenantId),
        });
      }
    },
  });
}

/** True only when workspace clock-in is explicitly enabled in settings. */
export function useClockInEnabled() {
  const { data: settings, isLoading } = useTenantSettings();
  if (isLoading) return { enabled: false, isLoading: true as const };
  const enabled = settings?.settings?.attendance?.clockInEnabled === true;
  return { enabled, isLoading: false as const };
}

export function useMembersPoints() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  return useQuery({
    queryKey: [...queryKeys.settings.membersPoints, tenantId],
    queryFn: fetchMembersPoints,
    enabled: !tenantLoading && Boolean(tenantId),
    staleTime: 60_000,
  });
}

export function useAssignPointsToAll() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: ({ points, reason }: { points: number; reason?: string }) =>
      assignPointsToAll(points, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.settings.membersPoints, tenantId],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoutouts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoutouts.points(tenantId ?? '') });
    },
  });
}

export function useHolidaySettings() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  return useQuery({
    queryKey: [...queryKeys.settings.holidays, tenantId],
    queryFn: fetchHolidaySettings,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useSupportedHolidayCountries() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  return useQuery({
    queryKey: [...queryKeys.settings.holidayCountries, tenantId],
    queryFn: fetchSupportedHolidayCountries,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useUpdateHolidaySettings() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: updateHolidaySettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.settings.holidays, tenantId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events });
    },
  });
}

export function useAddCustomHoliday() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: addCustomHoliday,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.settings.holidays, tenantId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events });
    },
  });
}

export function useRemoveCustomHoliday() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: removeCustomHoliday,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.settings.holidays, tenantId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events });
    },
  });
}
