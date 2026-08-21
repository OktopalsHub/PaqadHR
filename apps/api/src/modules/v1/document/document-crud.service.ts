import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditSeverity, AuditStatus } from 'src/common/enums/audit-action.enum';
import { DocumentType } from 'src/common/enums/document-type.enum';
import { AuditLogsService } from '../audit-logs/services/audit-logs.service';
import { DocumentRepository } from './document.repository';
import type { CreateDocumentDto } from './dto/create-document.dto';
import type { UpdateDocumentDto } from './dto/update-document.dto';
import type { Document } from './entities/document.entity';

@Injectable()
export class DocumentCrudService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async createDocument(
    tenantId: string,
    tenantMemberId: string,
    createDocumentDto: CreateDocumentDto,
  ): Promise<Document> {
    const doc = await this.documentRepository.createDocument(
      createDocumentDto,
      tenantId,
      tenantMemberId,
    );

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.FILE_UPLOADED,
        description: `Document "${createDocumentDto.name}" created`,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        resourceType: 'document',
        resourceId: doc.id,
        tenantId,
        userId: tenantMemberId,
        metadata: { name: createDocumentDto.name, type: createDocumentDto.type },
      })
      .catch(() => {});

    return doc;
  }

  async listDocuments(tenantId: string): Promise<Document[]> {
    return this.documentRepository.listDocuments(tenantId);
  }

  async getDocumentsByMemberId(memberId: string, tenantId: string): Promise<Document[]> {
    return this.documentRepository.getDocumentsByMemberId(memberId, tenantId);
  }

  async getDocument(id: string, tenantId: string): Promise<Document> {
    const document = await this.documentRepository.getDocument(id, tenantId);
    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found`);
    }
    return document;
  }

  async updateDocument(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    tenantId: string,
    actorMemberId?: string,
  ): Promise<Document> {
    await this.getDocument(id, tenantId);
    const updated = await this.documentRepository.updateDocument(id, updateDocumentDto, tenantId);

    if (actorMemberId) {
      void this.auditLogsService
        .queueAuditLog({
          action: AuditAction.UPDATE,
          description: `Document updated`,
          severity: AuditSeverity.LOW,
          status: AuditStatus.SUCCESS,
          resourceType: 'document',
          resourceId: id,
          tenantId,
          userId: actorMemberId,
          metadata: { updatedFields: Object.keys(updateDocumentDto) },
        })
        .catch(() => {});
    }

    return updated;
  }

  async deleteDocument(id: string, tenantId: string, actorMemberId?: string): Promise<void> {
    await this.getDocument(id, tenantId);
    await this.documentRepository.softDeleteDocument(id, tenantId);

    if (actorMemberId) {
      void this.auditLogsService
        .queueAuditLog({
          action: AuditAction.FILE_DELETED,
          description: `Document deleted`,
          severity: AuditSeverity.MEDIUM,
          status: AuditStatus.SUCCESS,
          resourceType: 'document',
          resourceId: id,
          tenantId,
          userId: actorMemberId,
        })
        .catch(() => {});
    }
  }

  async restoreDocument(id: string, tenantId: string): Promise<Document> {
    await this.documentRepository.restoreDocument(id, tenantId);
    return this.getDocument(id, tenantId);
  }

  async getDocumentsByType(type: string, tenantId: string): Promise<Document[]> {
    return this.documentRepository.getDocumentsByType(type as DocumentType, tenantId);
  }

  async getDocumentsByTypes(types: string[], tenantId: string): Promise<Document[]> {
    return this.documentRepository.getDocumentsByTypes(types as DocumentType[], tenantId);
  }

  async getDocumentsByCategory(category: string, tenantId: string): Promise<Document[]> {
    return this.documentRepository.getDocumentsByCategory(category, tenantId);
  }

  async getDocumentsByAccessLevel(accessLevel: string, tenantId: string): Promise<Document[]> {
    return this.documentRepository.getDocumentsByAccessLevel(accessLevel, tenantId);
  }

  async getDocumentsByVerificationStatus(
    tenantId: string,
    isVerified: boolean,
  ): Promise<Document[]> {
    return this.documentRepository.getDocumentsByVerificationStatus(tenantId, isVerified);
  }
}
