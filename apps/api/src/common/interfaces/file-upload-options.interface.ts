import type { FileUploadLocation } from '../enums/file-upload-location.enum';

export interface FileUploadOptions {
  tenantId: string;
  location: FileUploadLocation;
  fileName: string;
  contentType?: string;
  metadata?: Record<string, string>;
}
