import { BadRequestException } from '@nestjs/common';

import { DocumentType } from '../../../common/enums/document-type.enum';
import { DocumentUploadService } from './document-upload.service';

const tenantId = 'tenant-1';

function build(document: Record<string, unknown>, isManager: boolean) {
  const documentRepository = {
    getDocument: jest.fn().mockResolvedValue(document),
    createDocument: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const managerAccessService = { isManagerOf: jest.fn().mockResolvedValue(isManager) };
  const service = new DocumentUploadService(
    documentRepository as never,
    {} as never,
    {} as never,
    { queueAuditLog: jest.fn().mockResolvedValue(undefined) } as never,
    managerAccessService as never,
  );
  return { service, documentRepository };
}

describe('DocumentUploadService.checkDocumentAccess', () => {
  it('denies a manager HR-only documents', async () => {
    const { service } = build(
      { type: DocumentType.DISCIPLINARY_ACTION, tenantMemberId: 'report-1', isVerified: true },
      true,
    );
    await expect(service.checkDocumentAccess(tenantId, 'd', 'manager-1', 'member')).resolves.toBe(
      false,
    );
  });

  it('still lets a manager read a direct report employee document', async () => {
    const { service } = build(
      { type: DocumentType.PASSPORT, tenantMemberId: 'report-1', isVerified: true },
      true,
    );
    await expect(service.checkDocumentAccess(tenantId, 'd', 'manager-1', 'member')).resolves.toBe(
      true,
    );
  });

  it('denies a non-manager colleague employee-only documents', async () => {
    const { service } = build(
      { type: DocumentType.PASSPORT, tenantMemberId: 'report-1', isVerified: true },
      false,
    );
    await expect(service.checkDocumentAccess(tenantId, 'd', 'peer-1', 'member')).resolves.toBe(
      false,
    );
  });
});

describe('DocumentUploadService.createDocument file key', () => {
  const dto = (fileKey: string) =>
    ({ name: 'Passport', type: DocumentType.PASSPORT, fileKey }) as never;

  it.each([
    'tenants/other-tenant/documents/passport_1.pdf',
    'tenants/tenant-1/avatars/passport_1.pdf',
    'tenants/tenant-1/documents/../x/passport_1.pdf',
    'tenants/tenant-1/documents/a/b.pdf',
    'passport_1.pdf',
  ])('rejects key %s', async (key) => {
    const { service, documentRepository } = build({}, false);
    await expect(service.createDocument(tenantId, 'member-1', dto(key))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(documentRepository.createDocument).not.toHaveBeenCalled();
  });

  it('rejects a key already attached to another member', async () => {
    const { service, documentRepository } = build({}, false);
    documentRepository.findOne.mockResolvedValue({ id: 'x', tenantMemberId: 'member-2' });
    await expect(
      service.createDocument(tenantId, 'member-1', dto('tenants/tenant-1/documents/p_1.pdf')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(documentRepository.createDocument).not.toHaveBeenCalled();
  });

  it('accepts a freshly issued key', async () => {
    const { service, documentRepository } = build({}, false);
    await service.createDocument(tenantId, 'member-1', dto('tenants/tenant-1/documents/p_1.pdf'));
    expect(documentRepository.createDocument).toHaveBeenCalled();
  });
});
