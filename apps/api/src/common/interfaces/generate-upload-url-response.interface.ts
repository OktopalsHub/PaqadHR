import { FileUploadLocation } from "../enums/file-upload-location.enum";

export interface GenerateUploadUrlResponse {
    uploadUrl: string;
    fileKey: string;
    fileName: string;
    originalName: string;
    location: FileUploadLocation;
    expiresAt: Date;
}
