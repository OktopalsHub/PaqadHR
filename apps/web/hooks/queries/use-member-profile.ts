'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchMemberProfile,
  updateMemberProfile,
  type UpdateMemberProfileInput,
} from '@/lib/api/member-profile';
import { queryKeys } from '@/lib/query/keys';
import { formatDisplayName, formatPersonName, toTitleCase } from '@/lib/format-name';
import { getInitials } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';

export function useMemberProfile() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: queryKeys.member.profile(tenantId ?? ''),
    queryFn: fetchMemberProfile,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useUpdateMemberProfile() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: UpdateMemberProfileInput) => updateMemberProfile(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.member.profile(tenantId ?? '') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
    },
  });
}

function splitFullName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function memberFullName(
  profile?: { firstName?: string; lastName?: string },
  fallbackName?: string | null,
) {
  const formatted = formatPersonName(profile?.firstName, profile?.lastName, '');
  if (formatted) return formatted;
  if (fallbackName?.trim()) return formatDisplayName(fallbackName);
  return 'Member';
}

export function memberPreferredOrFirstName(
  profile?: { firstName?: string; preferredName?: string | null },
  fallbackName?: string | null,
) {
  if (profile?.preferredName?.trim()) return formatDisplayName(profile.preferredName);
  if (profile?.firstName?.trim()) return formatDisplayName(profile.firstName);
  if (fallbackName?.trim()) {
    const { firstName } = splitFullName(fallbackName);
    return firstName ? formatDisplayName(firstName) : formatDisplayName(fallbackName);
  }
  return 'there';
}

export function memberInitials(
  profile?: { firstName?: string; lastName?: string },
  fallbackName?: string | null,
) {
  const first = profile?.firstName?.trim();
  const last = profile?.lastName?.trim();
  if (first && last) {
    return `${toTitleCase(first)[0]}${toTitleCase(last)[0]}`.toUpperCase();
  }
  if (first) return toTitleCase(first).slice(0, 2).toUpperCase();
  if (fallbackName?.trim()) return getInitials(formatDisplayName(fallbackName)) ?? 'M';
  return 'M';
}

/** @deprecated Use memberFullName or memberPreferredOrFirstName instead */
export function memberDisplayName(
  profile?: {
    firstName?: string;
    lastName?: string;
    preferredName?: string | null;
  },
  fallbackName?: string | null,
) {
  return memberFullName(profile, fallbackName);
}
