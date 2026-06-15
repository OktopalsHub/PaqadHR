import type { Document } from '../../modules/v1/document/entities/document.entity';
import type { DocumentType } from '../enums/document-type.enum';

export interface IDocumentRepository {
  createDocument(
    createDocumentDto: Partial<Document>,
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Document>;
  getDocument(id: string, tenantId: string): Promise<Document | null>;
  listDocuments(tenantId: string): Promise<Document[]>;
  getDocumentsByMemberId(memberId: string, tenantId: string): Promise<Document[]>;
  getDocumentsByType(type: DocumentType, tenantId: string): Promise<Document[]>;
  updateDocument(
    id: string,
    updateDocumentDto: Partial<Document>,
    tenantId: string,
  ): Promise<Document>;
  deleteDocument(id: string, tenantId: string): Promise<void>;
  softDeleteDocument(id: string, tenantId: string): Promise<void>;
  restoreDocument(id: string, tenantId: string): Promise<void>;
}
