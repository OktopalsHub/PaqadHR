import { Injectable } from '@nestjs/common';
import { DocumentAccessLevel } from '../../../common/enums/document-access-level.enum';
import type { DocumentCategory } from '../../../common/enums/document-category.enum';
import { DocumentType } from '../../../common/enums/document-type.enum';
import { DocumentAccessService } from './document-access.service';
import { DocumentCrudService } from './document-crud.service';
import { DocumentOperationsService } from './document-operations.service';
import type { CreateDocumentDto } from './dto/create-document.dto';
import type { UpdateDocumentDto } from './dto/update-document.dto';
import type { Document } from './entities/document.entity';

@Injectable()
export class DocumentService {
  constructor(
    private readonly documentCrudService: DocumentCrudService,
    private readonly documentAccessService: DocumentAccessService,
    private readonly documentOperationsService: DocumentOperationsService,
  ) {}

  async createDocument(
    tenantId: string,
    tenantMemberId: string,
    createDocumentDto: CreateDocumentDto,
  ): Promise<Document> {
    return this.documentCrudService.createDocument(tenantId, tenantMemberId, createDocumentDto);
  }

  async listDocuments(tenantId: string): Promise<Document[]> {
    return this.documentCrudService.listDocuments(tenantId);
  }

  async getDocumentsByMemberId(
    memberId: string,
    tenantId: string,
    memberRole?: string,
  ): Promise<Document[]> {
    return this.documentAccessService.getDocumentsByMemberId(memberId, tenantId, memberRole);
  }

  async getDocument(id: string, tenantId: string): Promise<Document> {
    return this.documentCrudService.getDocument(id, tenantId);
  }

  async updateDocument(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    tenantId: string,
    actorMemberId?: string,
  ): Promise<Document> {
    return this.documentCrudService.updateDocument(id, updateDocumentDto, tenantId, actorMemberId);
  }

  async deleteDocument(id: string, tenantId: string, actorMemberId?: string): Promise<void> {
    return this.documentCrudService.deleteDocument(id, tenantId, actorMemberId);
  }

  async purgeExpiredDocument(document: Document): Promise<void> {
    return this.documentAccessService.purgeExpiredDocument(document);
  }

  async restoreDocument(id: string, tenantId: string): Promise<Document> {
    return this.documentCrudService.restoreDocument(id, tenantId);
  }

  async getDocumentsByType(type: DocumentType, tenantId: string): Promise<Document[]> {
    return this.documentCrudService.getDocumentsByType(type, tenantId);
  }

  async getEmployeeDocumentsByType(
    memberId: string,
    type: DocumentType,
    tenantId: string,
    memberRole?: string,
  ): Promise<Document[]> {
    return this.documentAccessService.getEmployeeDocumentsByType(
      memberId,
      type,
      tenantId,
      memberRole,
    );
  }

  async verifyDocument(id: string, tenantId: string, isVerified: boolean): Promise<Document> {
    return this.documentOperationsService.verifyDocument(id, tenantId, isVerified);
  }

  async getDocumentsByVerificationStatus(
    tenantId: string,
    isVerified: boolean,
  ): Promise<Document[]> {
    return this.documentCrudService.getDocumentsByVerificationStatus(tenantId, isVerified);
  }

  async getExpiringDocuments(tenantId: string, days: number): Promise<Document[]> {
    return this.documentOperationsService.getExpiringDocuments(tenantId, days);
  }

  async bulkVerifyDocuments(
    tenantId: string,
    documentIds: string[],
    isVerified: boolean,
  ): Promise<Document[]> {
    return this.documentOperationsService.bulkVerifyDocuments(tenantId, documentIds, isVerified);
  }

  async bulkDeleteDocuments(tenantId: string, documentIds: string[]): Promise<void> {
    return this.documentOperationsService.bulkDeleteDocuments(tenantId, documentIds);
  }

  async getDocumentAccessLogs(tenantId: string, documentId: string): Promise<unknown[]> {
    return this.documentOperationsService.getDocumentAccessLogs(tenantId, documentId);
  }

  async logDocumentAccess(
    tenantId: string,
    documentId: string,
    memberId: string,
    action: string,
  ): Promise<void> {
    return this.documentAccessService.logDocumentAccess(tenantId, documentId, memberId, action);
  }

  async getDocumentTemplates(tenantId: string): Promise<unknown[]> {
    return this.documentOperationsService.getDocumentTemplates(tenantId);
  }

  async initiateDigitalSignature(
    tenantId: string,
    documentId: string,
    signerEmails: string[],
  ): Promise<unknown> {
    return this.documentOperationsService.initiateDigitalSignature(
      tenantId,
      documentId,
      signerEmails,
    );
  }

  async getDocumentsByTypes(types: DocumentType[], tenantId: string): Promise<Document[]> {
    return this.documentCrudService.getDocumentsByTypes(types, tenantId);
  }

  async getDocumentsByCategory(category: DocumentCategory, tenantId: string): Promise<Document[]> {
    return this.documentCrudService.getDocumentsByCategory(category, tenantId);
  }

  async getDocumentsByAccessLevel(
    accessLevel: DocumentAccessLevel,
    tenantId: string,
  ): Promise<Document[]> {
    return this.documentCrudService.getDocumentsByAccessLevel(accessLevel, tenantId);
  }

  async getDocumentStatistics(tenantId: string): Promise<unknown> {
    return this.documentOperationsService.getDocumentStatistics(tenantId);
  }

  async checkDocumentAccess(
    tenantId: string,
    documentId: string,
    memberId: string,
    memberRole: string,
  ): Promise<boolean> {
    return this.documentAccessService.checkDocumentAccess(
      tenantId,
      documentId,
      memberId,
      memberRole,
    );
  }

  async downloadDocument(
    tenantId: string,
    id: string,
    memberId?: string,
    memberRole?: string,
  ): Promise<string> {
    return this.documentAccessService.downloadDocument(tenantId, id, memberId, memberRole);
  }

  filterDocumentsForMember(documents: Document[], memberRole?: string): Document[] {
    return this.documentAccessService.filterDocumentsForMember(documents, memberRole);
  }
}
