import type { ApiKeyScope } from '@paqadhr/contracts';
import { apiClient, tenantPath } from '@/lib/api/client';

export type { ApiKeyScope };
export type ApiKeyRecord = {
  id: string;
  name: string;
  scopes: ApiKeyScope[];
  keyPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdByMemberId: string;
};

export type CreateApiKeyInput = {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: string;
};

export type CreateApiKeyResult = ApiKeyRecord & {
  secret: string;
};

export async function fetchApiKeyScopes(tenantId: string): Promise<{ scopes: ApiKeyScope[] }> {
  return apiClient<{ scopes: ApiKeyScope[] }>(tenantPath(tenantId, 'api-keys/scopes'));
}

export async function fetchApiKeys(tenantId: string): Promise<ApiKeyRecord[]> {
  return apiClient<ApiKeyRecord[]>(tenantPath(tenantId, 'api-keys'));
}

export async function createApiKey(
  tenantId: string,
  input: CreateApiKeyInput,
): Promise<CreateApiKeyResult> {
  return apiClient<CreateApiKeyResult>(tenantPath(tenantId, 'api-keys'), {
    method: 'POST',
    data: input,
  });
}

export async function revokeApiKey(tenantId: string, keyId: string): Promise<void> {
  await apiClient(tenantPath(tenantId, `api-keys/${keyId}`), { method: 'DELETE' });
}
