import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateDocumentDto } from './create-document.dto';
import { BulkDeleteDocumentsDto } from './bulk-delete-documents.dto';
import { BulkVerifyDocumentsDto } from './bulk-verify-documents.dto';
import { LogDocumentAccessDto } from './log-document-access.dto';
import { SignDocumentDto } from './sign-document.dto';
import { UpdateDocumentDto } from './update-document.dto';

const errorsFor = async <T extends object>(cls: new () => T, plain: object) =>
  validate(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true });

const uuid = '0b0f6f9e-5b1a-4c63-9d27-0a8a3e1f0a11';

describe('document request DTOs', () => {
  it('create rejects isVerified', async () => {
    const errors = await errorsFor(CreateDocumentDto, {
      name: 'n',
      type: 'PASSPORT',
      fileKey: 'k',
      isVerified: true,
    });
    expect(errors.some((e) => e.property === 'isVerified')).toBe(true);
  });

  it('update rejects isVerified, type, memberId and fileKey', async () => {
    const errors = await errorsFor(UpdateDocumentDto, {
      isVerified: true,
      type: 'PASSPORT',
      memberId: uuid,
      fileKey: 'k',
    });
    expect(errors.map((e) => e.property).sort()).toEqual([
      'fileKey',
      'isVerified',
      'memberId',
      'type',
    ]);
  });

  it('update accepts descriptive fields', async () => {
    expect(await errorsFor(UpdateDocumentDto, { name: 'n', description: 'd' })).toHaveLength(0);
  });

  it('bulk verify requires uuids and a boolean and caps the list', async () => {
    expect(
      await errorsFor(BulkVerifyDocumentsDto, { documentIds: [uuid], isVerified: true }),
    ).toHaveLength(0);
    expect(
      (await errorsFor(BulkVerifyDocumentsDto, { documentIds: ['x'], isVerified: true })).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await errorsFor(BulkVerifyDocumentsDto, {
          documentIds: Array(101).fill(uuid),
          isVerified: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (await errorsFor(BulkVerifyDocumentsDto, { documentIds: [uuid], isVerified: true, extra: 1 }))
        .length,
    ).toBeGreaterThan(0);
  });

  it('bulk delete rejects unknown fields and bad ids', async () => {
    expect(await errorsFor(BulkDeleteDocumentsDto, { documentIds: [uuid] })).toHaveLength(0);
    expect(
      (await errorsFor(BulkDeleteDocumentsDto, { documentIds: [uuid], x: 1 })).length,
    ).toBeGreaterThan(0);
    expect((await errorsFor(BulkDeleteDocumentsDto, { documentIds: [] })).length).toBeGreaterThan(
      0,
    );
  });

  it('sign requires emails', async () => {
    expect(await errorsFor(SignDocumentDto, { signerEmails: ['a@b.co'] })).toHaveLength(0);
    expect((await errorsFor(SignDocumentDto, { signerEmails: ['nope'] })).length).toBeGreaterThan(
      0,
    );
    expect(
      (await errorsFor(SignDocumentDto, { signerEmails: ['a@b.co'], memberId: uuid })).length,
    ).toBeGreaterThan(0);
  });

  it('access log whitelists the action and rejects a caller-supplied memberId', async () => {
    expect(await errorsFor(LogDocumentAccessDto, { action: 'download' })).toHaveLength(0);
    expect((await errorsFor(LogDocumentAccessDto, { action: 'delete' })).length).toBeGreaterThan(0);
    expect(
      (await errorsFor(LogDocumentAccessDto, { action: 'view', memberId: uuid })).length,
    ).toBeGreaterThan(0);
  });
});
