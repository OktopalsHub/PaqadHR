import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CreateApiKeyInput,
  createApiKey,
  fetchApiKeyScopes,
  fetchApiKeys,
  revokeApiKey,
} from '@/lib/api/api-keys';
import { queryKeys } from '@/lib/query/keys';

export function useApiKeyScopes(tenantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.apiKeys.scopes(tenantId ?? ''),
    queryFn: () => fetchApiKeyScopes(tenantId!),
    enabled: Boolean(tenantId && enabled),
  });
}

export function useApiKeys(tenantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.apiKeys.all(tenantId ?? ''),
    queryFn: () => fetchApiKeys(tenantId!),
    enabled: Boolean(tenantId && enabled),
  });
}

export function useCreateApiKey(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiKeyInput) => createApiKey(tenantId!, input),
    onSuccess: () => {
      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all(tenantId) });
      }
    },
  });
}

export function useRevokeApiKey(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => revokeApiKey(tenantId!, keyId),
    onSuccess: () => {
      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all(tenantId) });
      }
    },
  });
}
