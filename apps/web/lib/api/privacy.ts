import { apiClient } from '@/lib/api/client';

export interface PrivacyConsentStatus {
  currentVersion: string;
  acceptedVersion: string | null;
  needsReconsent: boolean;
}

export async function fetchPrivacyConsentStatus(): Promise<PrivacyConsentStatus> {
  return apiClient<PrivacyConsentStatus>('/users/me/privacy-consent');
}

export async function acceptPrivacyPolicy(): Promise<void> {
  await apiClient('/users/me/privacy-consent', {
    method: 'POST',
    body: JSON.stringify({ termsAccepted: true }),
  });
}
