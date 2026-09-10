import { Logger } from '@nestjs/common';

const logger = new Logger('FileDownload');

export function getFileContentType(filename: string): string {
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

export function buildFileKey(tenantId: string, location: string, fileName: string): string {
  return `tenants/${tenantId}/${location}/${fileName}`;
}

export function parseFileKey(fileKey: string): {
  workspaceId: string;
  location: string;
  filename: string;
} | null {
  const parts = fileKey.split('/');
  if (parts.length !== 4 || parts[0] !== 'tenants') {
    logger.warn(`Invalid file key format: ${fileKey}`);
    return null;
  }
  return {
    workspaceId: parts[1],
    location: parts[2],
    filename: parts[3],
  };
}

export function validateFilename(filename: string): boolean {
  const dangerousPatterns = [/\.\./, /[<>:"|?*]/, /^\.+$/, /\/$|\\$/];
  return !dangerousPatterns.some((pattern) => pattern.test(filename));
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\.+/, '_')
    .replace(/[/\\]+$/, '')
    .trim();
}
