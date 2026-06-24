import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export type UploadUrlResponse = {
  uploadUrl: string;
  fileKey: string;
  fileName: string;
  originalName: string;
  location: string;
  expiresAt: string;
};

export type PresignedUploadLocation =
  | 'logo'
  | 'employees-avatar'
  | 'documents'
  | 'attachments'
  | 'avatars'
  | 'resumes'
  | 'assets';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml';

export function isAcceptedImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|svg)$/i.test(file.name);
}

export async function requestUploadUrl(
  location: PresignedUploadLocation,
  originalName: string,
  contentType?: string,
  tenantId?: string,
): Promise<UploadUrlResponse> {
  const resolvedTenantId = tenantId || (await resolveTenantId());
  return apiClient<UploadUrlResponse>(tenantPath(resolvedTenantId, 'files/upload-url'), {
    method: 'POST',
    body: JSON.stringify({
      location,
      originalName,
      contentType,
    }),
  });
}

export async function uploadFileToPresignedUrl(
  uploadUrl: string,
  file: File,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to upload file to storage');
  }
}

/** Request presigned URL, upload file, return stored file name for DB keys. */
export async function uploadViaPresignedUrl(
  file: File,
  location: PresignedUploadLocation,
): Promise<{ fileName: string; fileKey: string }> {
  const { uploadUrl, fileName, fileKey } = await requestUploadUrl(
    location,
    file.name,
    file.type || undefined,
  );
  await uploadFileToPresignedUrl(uploadUrl, file);
  return { fileName, fileKey };
}

export async function requestDocumentUploadUrl(
  originalName: string,
  contentType?: string,
  tenantId?: string,
): Promise<UploadUrlResponse> {
  return requestUploadUrl('documents', originalName, contentType, tenantId);
}

export async function uploadMemberAvatar(file: File) {
  if (!isAcceptedImageFile(file)) {
    throw new Error('Choose a JPEG, PNG, WebP, or GIF image');
  }
  return uploadViaPresignedUrl(file, 'employees-avatar');
}

export async function uploadWorkspaceLogo(file: File) {
  if (!isAcceptedImageFile(file)) {
    throw new Error('Choose a JPEG, PNG, WebP, or GIF image');
  }
  return uploadViaPresignedUrl(file, 'logo');
}
