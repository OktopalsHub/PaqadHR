import * as path from 'node:path';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ENVIRONMENT } from '../config/env.config';
import { FileUploadLocation } from '../enums/file-upload-location.enum';
import type { FileUrlResponse } from '../interfaces/file-url-response.interface';
import type { GenerateUploadUrlRequest } from '../interfaces/generate-upload-url-request.interface';
import type { GenerateUploadUrlResponse } from '../interfaces/generate-upload-url-response.interface';
import { CloudflareR2Service } from './cloudflare-r2.service';
import {
  buildFileKey,
  getFileContentType,
  parseFileKey,
  sanitizeFilename,
  validateFilename,
} from './file-download';
import {
  assertCandidateDocumentContentType,
  assertImageUploadContentType,
  FILE_SIZE_LIMITS,
  isPublicUploadLocation,
} from './file-upload';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly defaultExpiresIn = 3600;
  private readonly publicUrl: string | null;
  constructor(private readonly r2Service: CloudflareR2Service) {
    const { R2 } = ENVIRONMENT;
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
  async generateUploadUrl(request: GenerateUploadUrlRequest): Promise<GenerateUploadUrlResponse> {
    const { tenantId, location, originalName, contentType, contentLength, expiresIn } = request;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID is required');
    }
    if (!validateFilename(originalName)) {
      throw new BadRequestException('Invalid filename');
    }
    const sanitizedOriginalName = sanitizeFilename(originalName);
    const timestamp = Date.now();
    const fileExtension = path.extname(sanitizedOriginalName);
    const baseName = path.basename(sanitizedOriginalName, fileExtension);
    const fileName = `${baseName}_${timestamp}${fileExtension}`;
    const finalContentType = contentType || getFileContentType(sanitizedOriginalName);
    assertImageUploadContentType(location, finalContentType);
    assertCandidateDocumentContentType(location, finalContentType);
    const maxSize = FILE_SIZE_LIMITS[location] ?? 10 * 1024 * 1024;
    if (contentLength === undefined || contentLength <= 0 || contentLength > maxSize) {
      throw new BadRequestException(
        `File size must be between 1 and ${maxSize} bytes for ${location}`,
      );
    }
    const expires = expiresIn || this.defaultExpiresIn;
    try {
      const { uploadUrl, fileKey } = await this.r2Service.generateUploadUrl({
        tenantId,
        location,
        fileName,
        contentType: finalContentType,
        contentLength,
        expiresIn: expires,
        public: isPublicUploadLocation(location),
      });
      const expiresAt = new Date(Date.now() + expires * 1000);
      return {
        uploadUrl,
        fileKey,
        fileName,
        originalName: sanitizedOriginalName,
        location,
        expiresAt,
      };
    } catch (error) {
      this.logger.error(`Failed to generate upload URL for file: ${sanitizedOriginalName}`, error);
      throw new BadRequestException('Failed to generate upload URL');
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
      const fileKey = buildFileKey(tenantId, location, fileName);
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
    const fileKey = buildFileKey(tenantId, location, fileName);
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
  async deleteFile(
    tenantId: string,
    location: FileUploadLocation,
    fileName: string,
  ): Promise<void> {
    const fileKey = buildFileKey(tenantId, location, fileName);
    try {
      await this.r2Service.deleteFile(fileKey);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${fileName}`, error);
      throw new BadRequestException('Failed to delete file');
    }
  }
  async fileExists(
    tenantId: string,
    location: FileUploadLocation,
    fileName: string,
  ): Promise<boolean> {
    const fileKey = buildFileKey(tenantId, location, fileName);
    try {
      return await this.r2Service.fileExists(fileKey);
    } catch (error) {
      this.logger.error(`Failed to check file existence: ${fileName}`, error);
      return false;
    }
  }
  async listFiles(
    tenantId: string,
    location: FileUploadLocation,
  ): Promise<
    Array<{
      fileName: string;
      publicUrl: string | null;
      downloadUrl: string;
      size?: number;
      lastModified?: Date;
    }>
  > {
    try {
      const files = await this.r2Service.listFiles(tenantId, location);
      const result: Array<{
        fileName: string;
        publicUrl: string | null;
        downloadUrl: string;
        size?: number;
        lastModified?: Date;
      }> = [];
      for (const file of files) {
        const parsedKey = parseFileKey(file.key);
        if (parsedKey) {
          const publicUrl = this.generatePublicUrl(tenantId, location, parsedKey.filename);
          result.push({
            fileName: parsedKey.filename,
            publicUrl,
            downloadUrl: file.url,
            size: file.size,
            lastModified: file.lastModified,
          });
        }
      }
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to list files for tenant: ${tenantId}, location: ${location}`,
        error,
      );
      throw new BadRequestException('Failed to list files');
    }
  }
}
