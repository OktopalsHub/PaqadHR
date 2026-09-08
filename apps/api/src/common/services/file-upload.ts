import { BadRequestException } from '@nestjs/common';
import { FileUploadLocation } from '../enums/file-upload-location.enum';

const PUBLIC_UPLOAD_LOCATIONS = new Set<FileUploadLocation>([
  FileUploadLocation.LOGO,
  FileUploadLocation.EMPLOYEES_AVATAR,
  FileUploadLocation.AVATARS,
]);

const IMAGE_UPLOAD_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const CANDIDATE_DOCUMENT_LOCATIONS = new Set<FileUploadLocation>([
  FileUploadLocation.RESUMES,
  FileUploadLocation.COVER_LETTERS,
]);

const CANDIDATE_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const FILE_SIZE_LIMITS: Record<FileUploadLocation, number> = {
  [FileUploadLocation.LOGO]: 2 * 1024 * 1024,
  [FileUploadLocation.EMPLOYEES_AVATAR]: 2 * 1024 * 1024,
  [FileUploadLocation.AVATARS]: 2 * 1024 * 1024,
  [FileUploadLocation.RESUMES]: 5 * 1024 * 1024,
  [FileUploadLocation.COVER_LETTERS]: 5 * 1024 * 1024,
  [FileUploadLocation.DOCUMENTS]: 10 * 1024 * 1024,
  [FileUploadLocation.ATTACHMENTS]: 10 * 1024 * 1024,
} as const;

export function isPublicUploadLocation(location: FileUploadLocation): boolean {
  return PUBLIC_UPLOAD_LOCATIONS.has(location);
}

export function assertImageUploadContentType(
  location: FileUploadLocation,
  contentType: string,
): void {
  if (!PUBLIC_UPLOAD_LOCATIONS.has(location)) return;
  if (!IMAGE_UPLOAD_MIME_TYPES.has(contentType.toLowerCase())) {
    throw new BadRequestException(
      'This upload only accepts images (JPEG, PNG, WebP, GIF, or SVG). PDF, Word, Excel, and other documents are not allowed here.',
    );
  }
}

export function assertCandidateDocumentContentType(
  location: FileUploadLocation,
  contentType: string,
): void {
  if (!CANDIDATE_DOCUMENT_LOCATIONS.has(location)) return;
  if (!CANDIDATE_DOCUMENT_MIME_TYPES.has(contentType.toLowerCase())) {
    throw new BadRequestException(
      'Invalid file type. Upload PDF or Word documents only for resumes and cover letters.',
    );
  }
}
