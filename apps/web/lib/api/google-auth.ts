import { getApiV1Base } from '@/lib/api/client';

export function getGoogleAuthUrl(termsAccepted = false): string {
  const url = new URL(`${getApiV1Base()}/auth/google`);
  if (termsAccepted) {
    url.searchParams.set('termsAccepted', 'true');
  }
  return url.toString();
}
