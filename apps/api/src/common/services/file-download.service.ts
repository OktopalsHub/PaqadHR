import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FileUploadLocation } from '../enums/file-upload-location.enum';
import type { FileUrlResponse } from '../interfaces/file-url-response.interface';
import { CloudflareR2Service } from './cloudflare-r2.service';

@Injectable()
export class FileDownloadService {
  private readonly logger = new Logger(FileDownloadService.name);
  private readonly defaultExpiresIn = 3600;
  private readonly publicUrl: string | null;

  constructor(private readonly r2Service: CloudflareR2Service) {
    const { R2 } = require('../config/env.config').ENVIRONMENT;
    const customDomain = R2.CUSTOM_DOMAIN?.trim();
    const publicId = R2.PUBLIC_ID?.trim();
    if (customDomain) {
      this.publicUrl =
        customDomain.startsWith('http://') || customDomain.startsWith('https://')
          ? customDomain
          : `https://${customDomain}`;
    } else if (publicId) {
      this.publicUrl = `https://pub-${publicId}.r2.dev`;
    } else {
      this.publicUrl = null;
    }
  }

  generatePublicUrl(
    tenantId: string,
    location: FileUploadLocation,
    fileName: string,
  ): string | null {
    if (!this.publicUrl) {
      this.logger.warn('Public URL not configured for R2');
      return null;
    }
    const filePath = `tenants/${tenantId}/${location}/${fileName}`;
    return `${this.publicUrl}/${filePath}`;
  }

  async getFileUrls(
    tenantId: string,
    location: FileUploadLocation,
    fileName: string,
  ): Promise<FileUrlResponse> {
    const publicUrl = this.generatePublicUrl(tenantId, location, fileName);
    let downloadUrl: string | undefined;
    try {
      const fileKey = `tenants/${tenantId}/${location}/${fileName}`;
      downloadUrl = await this.r2Service.generateDownloadUrl(
        fileKey,
        this.defaultExpiresIn,
        fileName,
      );
    } catch (error) {
      this.logger.warn(`Failed to generate download URL for ${fileName}`, error);
    }
    return {
      publicUrl,
      downloadUrl,
      fileName,
      location,
    };
  }

  async generateDownloadUrl(
    tenantId: string,
    location: FileUploadLocation,
    fileName: string,
    expiresIn?: number,
    useOriginalName?: string,
  ): Promise<string> {
    const fileKey = `tenants/${tenantId}/${location}/${fileName}`;
    try {
      return await this.r2Service.generateDownloadUrl(
        fileKey,
        expiresIn || this.defaultExpiresIn,
        useOriginalName,
      );
    } catch (error) {
      this.logger.error(`Failed to generate download URL for file: ${fileName}`, error);
      throw new BadRequestException('Failed to generate download URL');
    }
  }
}
