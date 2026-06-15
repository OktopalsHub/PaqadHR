import type { FileUploadLocation } from '../enums/file-upload-location.enum';

export interface FileUrlOptions {
  tenantId: string;
  location: FileUploadLocation;
  fileName: string;
}
