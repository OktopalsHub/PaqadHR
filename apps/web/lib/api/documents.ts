import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export type ApiDocument = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  isVerified: boolean;
  issueDate?: string | null;
  createdAt?: string;
  downloadUrl?: string | null;
};

export async function fetchMemberDocuments(
  memberId: string,
  tenantId?: string,
): Promise<ApiDocument[]> {
  const resolvedTenantId = tenantId || (await resolveTenantId());
  const params = new URLSearchParams({ memberId });
  const data = await apiClient<ApiDocument[]>(
    `${tenantPath(resolvedTenantId, 'documents')}?${params.toString()}`,
  );
  return Array.isArray(data) ? data : [];
}

export async function downloadDocument(documentId: string, tenantId?: string): Promise<string> {
  const resolvedTenantId = tenantId || (await resolveTenantId());
  const result = await apiClient<{ downloadUrl: string }>(
    tenantPath(resolvedTenantId, `documents/${documentId}/download`),
  );
  return result.downloadUrl;
}

export type CreateMemberDocumentInput = {
  name: string;
  type: string;
  fileKey: string;
  description?: string;
  issueDate?: string;
};

export async function createMemberDocument(
  memberId: string,
  input: CreateMemberDocumentInput,
  tenantId?: string,
): Promise<ApiDocument> {
  const resolvedTenantId = tenantId || (await resolveTenantId());
  return apiClient<ApiDocument>(tenantPath(resolvedTenantId, 'documents'), {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      memberId,
    }),
  });
}

export async function verifyMemberDocument(
  documentId: string,
  tenantId?: string,
): Promise<ApiDocument> {
  const resolvedTenantId = tenantId || (await resolveTenantId());
  return apiClient<ApiDocument>(
    `${tenantPath(resolvedTenantId, `documents/${documentId}/verify`)}?isVerified=true`,
    { method: 'POST' },
  );
}

export async function deleteMemberDocument(documentId: string, tenantId?: string): Promise<void> {
  const resolvedTenantId = tenantId || (await resolveTenantId());
  await apiClient(tenantPath(resolvedTenantId, `documents/${documentId}`), {
    method: 'DELETE',
  });
}
