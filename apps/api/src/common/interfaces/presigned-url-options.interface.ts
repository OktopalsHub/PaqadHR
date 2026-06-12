import { FileUploadLocation } from "../enums/file-upload-location.enum";

export interface PresignedUrlOptions {
    tenantId: string;
    location: FileUploadLocation;
    fileName: string;
    contentType?: string;
    expiresIn?: number;
}
