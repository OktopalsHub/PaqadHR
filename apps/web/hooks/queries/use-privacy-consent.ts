'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptPrivacyPolicy,
  fetchPrivacyConsentStatus,
  type PrivacyConsentStatus,
} from '@/lib/api/privacy';
import { queryKeys } from '@/lib/query/keys';

/** Pure cache updater — acceptance touches only the given user's consent entry. */
export function applyAcceptedPrivacyConsentCache(
  current: PrivacyConsentStatus | undefined,
): PrivacyConsentStatus | undefined {
  if (!current) return current;
  return {
    ...current,
    acceptedVersion: current.currentVersion,
    needsReconsent: false,
  };
}

export function usePrivacyConsentStatus(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.privacy.consent(userId ?? 'anonymous'),
    queryFn: fetchPrivacyConsentStatus,
    enabled: Boolean(userId) && enabled,
    staleTime: 60_000,
  });
}

export function useAcceptPrivacyPolicy(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptPrivacyPolicy,
    onSuccess: () => {
      if (!userId) return;
      queryClient.setQueryData<PrivacyConsentStatus>(
        queryKeys.privacy.consent(userId),
        applyAcceptedPrivacyConsentCache,
      );
    },
  });
}
