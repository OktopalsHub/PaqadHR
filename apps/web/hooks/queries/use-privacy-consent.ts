'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptPrivacyPolicy,
  fetchPrivacyConsentStatus,
  type PrivacyConsentStatus,
} from '@/lib/api/privacy';
import { queryKeys } from '@/lib/query/keys';

export function usePrivacyConsentStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.privacy.consent,
    queryFn: fetchPrivacyConsentStatus,
    enabled,
    staleTime: 60_000,
  });
}

export function useAcceptPrivacyPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptPrivacyPolicy,
    onSuccess: () => {
      queryClient.setQueryData<PrivacyConsentStatus>(queryKeys.privacy.consent, (current) =>
        current
          ? {
              ...current,
              acceptedVersion: current.currentVersion,
              needsReconsent: false,
            }
          : current,
      );
    },
  });
}
