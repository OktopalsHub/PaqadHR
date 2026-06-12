import { Injectable, Logger } from '@nestjs/common';
import { ENVIRONMENT } from '../config/env.config';
import { FileUploadLocation } from '../enums/file-upload-location.enum';
import { FileUrlOptions } from "../interfaces/file-url-options.interface";
import { FileUrlResponse } from "../interfaces/file-url-response.interface";

@Injectable()
export class FileUrlService {
  private readonly logger = new Logger(FileUrlService.name);
  private readonly publicUrl: string | null;
  constructor() {
    const { CLOUDFLARE_R2 } = ENVIRONMENT;
    if (CLOUDFLARE_R2.CUSTOM_DOMAIN) {
      this.publicUrl = `https://${CLOUDFLARE_R2.CUSTOM_DOMAIN}`;
    } else if (CLOUDFLARE_R2.PUBLIC_ID) {
      this.publicUrl = `https://pub-${CLOUDFLARE_R2.PUBLIC_ID}.r2.dev`;
    } else {
      this.publicUrl = null;
    }
  }
  generateFileUrl(options: FileUrlOptions): string | null {
    const { tenantId, location, fileName } = options;
    if (!this.publicUrl) {
      this.logger.warn('Public URL not configured for R2');
      return null;
    }
    if (!fileName) {
      return null;
    }
    const filePath = `tenants/${tenantId}/${location}/${fileName}`;
    return `${this.publicUrl}/${filePath}`;
  }
  generateFileUrlResponse(options: FileUrlOptions): FileUrlResponse {
    const publicUrl = this.generateFileUrl(options);
    return {
      publicUrl,
      fileName: options.fileName,
      location: options.location,
    };
  }
  generateMultipleFileUrls(
    tenantId: string,
    files: Array<{ location: FileUploadLocation; fileName: string }>,
  ): Array<FileUrlResponse> {
    return files.map((file) =>
      this.generateFileUrlResponse({
        tenantId,
        location: file.location,
        fileName: file.fileName,
      }),
    );
  }
  isConfigured(): boolean {
    return this.publicUrl !== null;
  }
  getBaseUrl(): string | null {
    return this.publicUrl;
  }
  getTenantLogoUrl(tenantId: string, logoKey: string): string | null {
    return this.generateFileUrl({
      tenantId,
      location: FileUploadLocation.LOGO,
      fileName: logoKey,
    });
  }
  getMemberAvatarUrl(tenantId: string, avatarKey: string): string | null {
    return this.generateFileUrl({
      tenantId,
      location: FileUploadLocation.EMPLOYEES_AVATAR,
      fileName: avatarKey,
    });
  }
  getDocumentUrl(tenantId: string, fileKey: string): string | null {
    return this.generateFileUrl({
      tenantId,
      location: FileUploadLocation.DOCUMENTS,
      fileName: fileKey,
    });
  }
  getResumeUrl(tenantId: string, fileName: string): string | null {
    return this.generateFileUrl({
      tenantId,
      location: FileUploadLocation.RESUMES,
      fileName: fileName,
    });
  }
  getAssetDocumentUrl(tenantId: string, fileName: string): string | null {
    return this.generateFileUrl({
      tenantId,
      location: FileUploadLocation.ASSETS,
      fileName: fileName,
    });
  }
  getAttachmentUrl(tenantId: string, fileName: string): string | null {
    return this.generateFileUrl({
      tenantId,
      location: FileUploadLocation.ATTACHMENTS,
      fileName: fileName,
    });
  }
  getUserAvatarUrl(tenantId: string, fileName: string): string | null {
    return this.generateFileUrl({
      tenantId,
      location: FileUploadLocation.AVATARS,
      fileName: fileName,
    });
  }
}
