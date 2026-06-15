import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ENVIRONMENT } from '../config/env.config';
import type { FileUploadLocation } from '../enums/file-upload-location.enum';
import type { FileInfo } from '../interfaces/file-info.interface';
import type { FileUploadOptions } from '../interfaces/file-upload-options.interface';
import type { PresignedUrlOptions } from '../interfaces/presigned-url-options.interface';

@Injectable()
export class CloudflareR2Service {
  private readonly logger = new Logger(CloudflareR2Service.name);
  private s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly publicId: string | null;
  private readonly customDomain: string | null;
  private readonly publicUrl: string | null;
  private readonly presignedUrlExpires = 3600;
  constructor() {
    const { CLOUDFLARE_R2 } = ENVIRONMENT;
    const accountId = CLOUDFLARE_R2.ACCOUNT_ID;
    const publicId = CLOUDFLARE_R2.PUBLIC_ID;
    const customDomain = CLOUDFLARE_R2.CUSTOM_DOMAIN;
    const accessKeyId = CLOUDFLARE_R2.ACCESS_KEY_ID;
    const secretAccessKey = CLOUDFLARE_R2.SECRET_ACCESS_KEY;
    this.bucketName = CLOUDFLARE_R2.BUCKET_NAME;
    this.publicId = publicId || null;
    this.customDomain = customDomain || null;
    if (this.customDomain) {
      this.publicUrl = `https://${this.customDomain}`;
      this.logger.log(`Using custom domain: ${this.publicUrl}`);
    } else if (this.publicId) {
      this.publicUrl = `https://pub-${this.publicId}.r2.dev`;
      this.logger.log(`Using R2.dev public URL: ${this.publicUrl}`);
    } else {
      this.publicUrl = null;
      this.logger.warn(
        'No custom domain or public ID configured. Public URLs will not be available.',
      );
    }
    const missingR2 = !accountId || !accessKeyId || !secretAccessKey || !this.bucketName;
    if (missingR2) {
      throw new BadRequestException(
        'Missing required Cloudflare R2 configuration (CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME)',
      );
    }
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
    this.logger.log('Cloudflare R2 service initialized');
  }
  private getClient(): S3Client {
    if (!this.s3Client) {
      throw new BadRequestException(
        'Cloudflare R2 is not configured. File storage is unavailable.',
      );
    }
    return this.s3Client;
  }

  private generateFileKey(
    tenantId: string,
    location: FileUploadLocation,
    fileName: string,
  ): string {
    const sanitizedFileName = fileName.replace(/[/\\]/g, '_');
    return `tenants/${tenantId}/${location}/${sanitizedFileName}`;
  }
  async generateUploadUrl(
    options: PresignedUrlOptions,
  ): Promise<{ uploadUrl: string; fileKey: string }> {
    const fileKey = this.generateFileKey(options.tenantId, options.location, options.fileName);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ContentType: options.contentType,
      ACL: 'public-read',
    });
    try {
      const uploadUrl = await getSignedUrl(this.getClient(), command, {
        expiresIn: options.expiresIn || this.presignedUrlExpires,
      });
      this.logger.debug(`Generated upload URL for key: ${fileKey}`);
      return { uploadUrl, fileKey };
    } catch (error) {
      this.logger.error(`Failed to generate upload URL for key: ${fileKey}`, error);
      throw new BadRequestException('Failed to generate upload URL');
    }
  }
  async generateDownloadUrl(
    fileKey: string,
    expiresIn?: number,
    customFilename?: string,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ResponseContentDisposition: customFilename
        ? `attachment; filename="${customFilename}"`
        : undefined,
    });
    try {
      const downloadUrl = await getSignedUrl(this.getClient(), command, {
        expiresIn: expiresIn || this.presignedUrlExpires,
      });
      this.logger.debug(
        `Generated download URL for key: ${fileKey}${customFilename ? ` with filename: ${customFilename}` : ''}`,
      );
      return downloadUrl;
    } catch (error) {
      this.logger.error(`Failed to generate download URL for key: ${fileKey}`, error);
      throw new BadRequestException('Failed to generate download URL');
    }
  }
  getPublicUrl(fileKey: string): string | undefined {
    if (!this.publicUrl) {
      return undefined;
    }
    return `${this.publicUrl}/${fileKey}`;
  }
  async getFileInfo(fileKey: string): Promise<FileInfo | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });
      const response = await this.getClient().send(command);
      const downloadUrl = await this.generateDownloadUrl(fileKey);
      const publicUrl = this.getPublicUrl(fileKey);
      return {
        key: fileKey,
        url: downloadUrl,
        publicUrl,
        size: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
      };
    } catch (error) {
      if (error.name === 'NotFound') {
        return null;
      }
      this.logger.error(`Failed to get file info for key: ${fileKey}`, error);
      throw new BadRequestException('Failed to get file information');
    }
  }
  async deleteFile(fileKey: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });
      await this.getClient().send(command);
      this.logger.debug(`Deleted file with key: ${fileKey}`);
    } catch (error) {
      this.logger.error(`Failed to delete file with key: ${fileKey}`, error);
      throw new BadRequestException('Failed to delete file');
    }
  }
  async fileExists(fileKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });
      await this.getClient().send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      this.logger.error(`Failed to check file existence for key: ${fileKey}`, error);
      throw new BadRequestException('Failed to check file existence');
    }
  }
  async uploadFile(options: FileUploadOptions, buffer: Buffer): Promise<FileInfo> {
    const fileKey = this.generateFileKey(options.tenantId, options.location, options.fileName);
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: buffer,
        ContentType: options.contentType,
        Metadata: options.metadata,
        ACL: 'public-read',
      });
      await this.getClient().send(command);
      const downloadUrl = await this.generateDownloadUrl(fileKey);
      const publicUrl = this.getPublicUrl(fileKey);
      this.logger.debug(`Uploaded file with key: ${fileKey}`);
      return {
        key: fileKey,
        url: downloadUrl,
        publicUrl,
        size: buffer.length,
        contentType: options.contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file with key: ${fileKey}`, error);
      throw new BadRequestException('Failed to upload file');
    }
  }
  async listFiles(tenantId: string, location: FileUploadLocation): Promise<FileInfo[]> {
    const prefix = `tenants/${tenantId}/${location}/`;
    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });
      const response = await this.getClient().send(command);
      if (!response.Contents) {
        return [];
      }
      const files: FileInfo[] = [];
      for (const object of response.Contents) {
        if (object.Key) {
          const downloadUrl = await this.generateDownloadUrl(object.Key);
          const publicUrl = this.getPublicUrl(object.Key);
          files.push({
            key: object.Key,
            url: downloadUrl,
            publicUrl,
            size: object.Size,
            lastModified: object.LastModified,
          });
        }
      }
      return files;
    } catch (error) {
      this.logger.error(
        `Failed to list files for tenant: ${tenantId}, location: ${location}`,
        error,
      );
      throw new BadRequestException('Failed to list files');
    }
  }
}
