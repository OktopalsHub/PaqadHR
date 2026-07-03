import { FileUploadLocation } from '../enums/file-upload-location.enum';
import { FileUrlService } from '../services/file-url.service';

export interface FileUrlMappingOptions {
  tenantId: string;
  fileUrlService: FileUrlService;
}

export class FileUrlMapper {
  static mapTenantLogo(logoKey: string | null, options: FileUrlMappingOptions): string | null {
    if (!logoKey) return null;
    return options.fileUrlService.generateFileUrl({
      tenantId: options.tenantId,
      location: FileUploadLocation.LOGO,
      fileName: logoKey,
    });
  }

  static mapMemberAvatar(avatarKey: string | null, options: FileUrlMappingOptions): string | null {
    if (!avatarKey) return null;
    return options.fileUrlService.generateFileUrl({
      tenantId: options.tenantId,
      location: FileUploadLocation.EMPLOYEES_AVATAR,
      fileName: avatarKey,
    });
  }

  static mapDocument(fileKey: string | null, options: FileUrlMappingOptions): string | null {
    if (!fileKey) return null;
    return options.fileUrlService.generateFileUrl({
      tenantId: options.tenantId,
      location: FileUploadLocation.DOCUMENTS,
      fileName: fileKey,
    });
  }

  static mapResume(fileName: string | null, options: FileUrlMappingOptions): string | null {
    if (!fileName) return null;
    return options.fileUrlService.generateFileUrl({
      tenantId: options.tenantId,
      location: FileUploadLocation.RESUMES,
      fileName,
    });
  }

  static mapFileByLocation(
    fileName: string | null,
    location: FileUploadLocation,
    options: FileUrlMappingOptions,
  ): string | null {
    if (!fileName) return null;
    return options.fileUrlService.generateFileUrl({
      tenantId: options.tenantId,
      location,
      fileName,
    });
  }
}
