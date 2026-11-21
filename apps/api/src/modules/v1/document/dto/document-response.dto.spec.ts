import { DocumentType } from 'src/common/enums/document-type.enum';

import type { Document } from '../entities/document.entity';
import { DocumentMapper } from './document-response.dto';

const doc = {
  id: 'd1',
  name: 'Passport',
  type: DocumentType.PASSPORT,
  fileKey: 'tenants/t1/documents/secret-key.pdf',
  fileUrl: 'https://cdn/secret-key.pdf',
  issueDate: new Date('2024-01-01'),
  expiryDate: new Date('2030-01-01'),
  description: 'd',
  isVerified: true,
  tenantMemberId: 'm1',
  tenantId: 't1',
  createdAt: new Date('2024-01-02'),
  tenantMember: { id: 'm1', phone: '+2348000000000', identityBvn: 'CIPHERBVN' },
} as unknown as Document;

describe('DocumentMapper', () => {
  it('keeps the fields the client reads', () => {
    expect(DocumentMapper.toResponse(doc)).toMatchObject({
      id: 'd1',
      name: 'Passport',
      type: DocumentType.PASSPORT,
      isVerified: true,
      description: 'd',
      tenantMemberId: 'm1',
    });
  });

  it('hides storage keys, file urls and uploader member rows', () => {
    const json = JSON.stringify(DocumentMapper.toResponseList([doc]));
    for (const leak of ['secret-key', 'fileKey', 'fileUrl', 'CIPHER', 'phone', 'tenantMember"']) {
      expect(json).not.toContain(leak);
    }
  });
});
