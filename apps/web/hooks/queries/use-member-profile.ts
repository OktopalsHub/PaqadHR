'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMemberProfile } from '@/lib/api/member-profile';
import { queryKeys } from '@/lib/query/keys';
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
  const first = profile?.firstName?.trim() ?? '';
  const last = profile?.lastName?.trim() ?? '';
  if (first || last) return [first, last].filter(Boolean).join(' ');
  if (fallbackName?.trim()) return fallbackName.trim();
  return 'Member';
}

export function memberPreferredOrFirstName(
  profile?: { firstName?: string; preferredName?: string | null },
  fallbackName?: string | null,
) {
  if (profile?.preferredName?.trim()) return profile.preferredName.trim();
  if (profile?.firstName?.trim()) return profile.firstName.trim();
  if (fallbackName?.trim()) {
    const { firstName } = splitFullName(fallbackName);
    return firstName || fallbackName.trim();
  }
  return 'there';
}

export function memberInitials(
  profile?: { firstName?: string; lastName?: string },
  fallbackName?: string | null,
) {
  const first = profile?.firstName?.trim();
  const last = profile?.lastName?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (fallbackName?.trim()) return getInitials(fallbackName) ?? 'M';
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
