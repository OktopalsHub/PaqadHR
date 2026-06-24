import { getApiV1Base } from '@/lib/api/client';

export function getGoogleAuthUrl(): string {
  return `${getApiV1Base()}/auth/google`;
}
