import { BadRequestException } from '@nestjs/common';
import { FileUploadLocation } from 'src/common/enums/file-upload-location.enum';
import {
  assertCandidateDocumentContentType,
  assertImageUploadContentType,
  isPublicUploadLocation,
} from './file.service';

describe('file upload security helpers', () => {
  it('treats resume locations as private', () => {
    expect(isPublicUploadLocation(FileUploadLocation.RESUMES)).toBe(false);
    expect(isPublicUploadLocation(FileUploadLocation.LOGO)).toBe(true);
  });

  it('allows pdf and docx for candidate uploads', () => {
    expect(() =>
      assertCandidateDocumentContentType(FileUploadLocation.RESUMES, 'application/pdf'),
    ).not.toThrow();
  });

  it('rejects html uploads for candidate documents', () => {
    expect(() =>
      assertCandidateDocumentContentType(FileUploadLocation.RESUMES, 'text/html'),
    ).toThrow(BadRequestException);
  });

  it('allows jpeg and svg for logo/avatar uploads', () => {
    expect(() => assertImageUploadContentType(FileUploadLocation.LOGO, 'image/jpeg')).not.toThrow();
    expect(() =>
      assertImageUploadContentType(FileUploadLocation.AVATARS, 'image/svg+xml'),
    ).not.toThrow();
  });

  it('rejects pdf on image upload locations with a clear message', () => {
    expect(() =>
      assertImageUploadContentType(FileUploadLocation.EMPLOYEES_AVATAR, 'application/pdf'),
    ).toThrow(/only accepts images/);
  });
});
