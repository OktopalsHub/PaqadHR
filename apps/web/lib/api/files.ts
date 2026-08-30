import axios from 'axios';
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

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

export const IMAGE_UPLOAD_ERROR =
  'Choose an image file only (JPEG, PNG, WebP, GIF, or SVG). PDF, Word, Excel, and other documents are not allowed.';

export function isAcceptedImageFile(file: File): boolean {
  if (file.type && ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) return true;
  return /\.(jpe?g|png|webp|gif|svg)$/i.test(file.name);
}

export async function requestUploadUrl(
  location: PresignedUploadLocation,
  originalName: string,
  contentType?: string,
  tenantId?: string,
  contentLength?: number,
): Promise<UploadUrlResponse> {
  const resolvedTenantId = tenantId || (await resolveTenantId());
  return apiClient<UploadUrlResponse>(tenantPath(resolvedTenantId, 'files/upload-url'), {
    method: 'POST',
    body: JSON.stringify({
      location,
      originalName,
      contentType,
      contentLength,
    }),
  });
}

export async function uploadFileToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  await axios.put(uploadUrl, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  });
}

export async function uploadViaPresignedUrl(
  file: File,
  location: PresignedUploadLocation,
): Promise<{ fileName: string; fileKey: string }> {
  const { uploadUrl, fileName, fileKey } = await requestUploadUrl(
    location,
    file.name,
    file.type || undefined,
    undefined,
    file.size,
  );
  await uploadFileToPresignedUrl(uploadUrl, file);
  return { fileName, fileKey };
}

export async function requestDocumentUploadUrl(
  originalName: string,
  contentType?: string,
  tenantId?: string,
  contentLength?: number,
): Promise<UploadUrlResponse> {
  return requestUploadUrl('documents', originalName, contentType, tenantId, contentLength);
}

export async function uploadMemberAvatar(file: File) {
  if (!isAcceptedImageFile(file)) {
    throw new Error(IMAGE_UPLOAD_ERROR);
  }
  return uploadViaPresignedUrl(file, 'employees-avatar');
}

export async function uploadWorkspaceLogo(file: File) {
  if (!isAcceptedImageFile(file)) {
    throw new Error(IMAGE_UPLOAD_ERROR);
  }
  return uploadViaPresignedUrl(file, 'logo');
}
