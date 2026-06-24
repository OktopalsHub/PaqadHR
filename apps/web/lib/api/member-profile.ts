import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import { formatDisplayName } from '@/lib/format-name';
import { memberProfileSchema } from '@/lib/schemas/member-profile';

function formatMemberProfile<T extends { firstName?: string; lastName?: string; preferredName?: string | null }>(
  profile: T,
): T {
  return {
    ...profile,
    firstName: profile.firstName ? formatDisplayName(profile.firstName) : profile.firstName,
    lastName: profile.lastName ? formatDisplayName(profile.lastName) : profile.lastName,
    preferredName: profile.preferredName
      ? formatDisplayName(profile.preferredName)
      : profile.preferredName,
  };
}

export async function fetchMemberProfile() {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, 'profile'));
  return memberProfileSchema.parse(formatMemberProfile(data as object));
}

export type UpdateMemberProfileInput = {
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  avatarKey?: string;
};

export async function updateMemberProfile(input: UpdateMemberProfileInput) {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, 'profile'), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return memberProfileSchema.parse(formatMemberProfile(data as object));
}
