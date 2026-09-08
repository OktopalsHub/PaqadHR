import * as path from 'node:path';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { FileUploadLocation } from '../enums/file-upload-location.enum';
import type { GenerateUploadUrlRequest } from '../interfaces/generate-upload-url-request.interface';
import type { GenerateUploadUrlResponse } from '../interfaces/generate-upload-url-response.interface';
import { CloudflareR2Service } from './cloudflare-r2.service';

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

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
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
    return `${this.publicUrl}/tenants/${tenantId}/${location}/${fileName}`;
  }

  async generateUploadUrl(request: GenerateUploadUrlRequest): Promise<GenerateUploadUrlResponse> {
    const { tenantId, location, originalName, contentType, contentLength, expiresIn } = request;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID is required');
    }
    if (!this.validateFilename(originalName)) {
      throw new BadRequestException('Invalid filename');
    }
    const sanitizedOriginalName = this.sanitizeFilename(originalName);
    const timestamp = Date.now();
    const fileExtension = path.extname(sanitizedOriginalName);
    const baseName = path.basename(sanitizedOriginalName, fileExtension);
    const fileName = `${baseName}_${timestamp}${fileExtension}`;
    const finalContentType = contentType || this.getContentType(sanitizedOriginalName);
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

  async deleteFile(
    tenantId: string,
    location: FileUploadLocation,
    fileName: string,
  ): Promise<void> {
    const fileKey = this.generateFileKey(tenantId, location, fileName);
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
    const fileKey = this.generateFileKey(tenantId, location, fileName);
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
        const parsedKey = this.parseFileKey(file.key);
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

  generateFileKey(tenantId: string, location: FileUploadLocation, fileName: string): string {
    return `tenants/${tenantId}/${location}/${fileName}`;
  }

  private parseFileKey(fileKey: string): {
    workspaceId: string;
    location: string;
    filename: string;
  } | null {
    const parts = fileKey.split('/');
    if (parts.length !== 4 || parts[0] !== 'tenants') {
      this.logger.warn(`Invalid file key format: ${fileKey}`);
      return null;
    }
    return {
      workspaceId: parts[1],
      location: parts[2],
      filename: parts[3],
    };
  }

  validateFilename(filename: string): boolean {
    const dangerousPatterns = [/\.\./, /[<>:"|?*]/, /^\.+$/, /\/$|\\$/];
    return !dangerousPatterns.some((pattern) => pattern.test(filename));
  }

  sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"|?*]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/^\.+/, '_')
      .replace(/[/\\]+$/, '')
      .trim();
  }

  getContentType(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop();
    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      csv: 'text/csv',
      json: 'application/json',
      xml: 'application/xml',
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
    };
    return contentTypeMap[extension || ''] || 'application/octet-stream';
  }
}
