import { apiClient, getApiV1Base } from '@/lib/api/client';

/** Records browser-bound consent (httpOnly cookie) before starting Google OAuth. */
export async function prepareGoogleAuthConsent(): Promise<void> {
  await apiClient('/auth/google/consent', {
    method: 'POST',
    body: { termsAccepted: true },
  });
}

export function getGoogleAuthUrl(): string {
  return `${getApiV1Base()}/auth/google`;
}
