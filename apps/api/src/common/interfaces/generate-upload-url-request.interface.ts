import type { FileUploadLocation } from '../enums/file-upload-location.enum';

export interface GenerateUploadUrlRequest {
  tenantId: string;
  location: FileUploadLocation;
  originalName: string;
  contentType?: string;
  contentLength?: number;
  expiresIn?: number;
}
