import type { FileUploadLocation } from '../enums/file-upload-location.enum';

export interface FileUrlResponse {
  publicUrl: string | null;
  downloadUrl?: string;
  fileName: string;
  location: FileUploadLocation;
}
