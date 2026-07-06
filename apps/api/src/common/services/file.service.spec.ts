import { BadRequestException } from '@nestjs/common';
import { FileUploadLocation } from 'src/common/enums/file-upload-location.enum';
import {
  assertCandidateDocumentContentType,
  isPublicUploadLocation,
} from './file.service';

describe('file upload security helpers', () => {
  it('treats resume locations as private', () => {
    expect(isPublicUploadLocation(FileUploadLocation.RESUMES)).toBe(false);
    expect(isPublicUploadLocation(FileUploadLocation.LOGO)).toBe(true);
  });

  it('allows pdf and docx for candidate uploads', () => {
    expect(() =>
      assertCandidateDocumentContentType(
        FileUploadLocation.RESUMES,
        'application/pdf',
      ),
    ).not.toThrow();
  });

  it('rejects html uploads for candidate documents', () => {
    expect(() =>
      assertCandidateDocumentContentType(FileUploadLocation.RESUMES, 'text/html'),
    ).toThrow(BadRequestException);
  });
});
