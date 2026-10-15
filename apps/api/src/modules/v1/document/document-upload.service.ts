import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditSeverity, AuditStatus } from 'src/common/enums/audit-action.enum';
import { FileUploadLocation } from 'src/common/enums/file-upload-location.enum';
import { CloudflareR2Service } from 'src/common/services/cloudflare-r2.service';
import { FileService } from 'src/common/services/file.service';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { DocumentAccessLevel } from '../../../common/enums/document-access-level.enum';
import type { DocumentCategory } from '../../../common/enums/document-category.enum';
import { DocumentType } from '../../../common/enums/document-type.enum';
import { AuditLogsService } from '../audit-logs/services/audit-logs.service';
import { DocumentRepository } from './document.repository';
import type { CreateDocumentDto } from './dto/create-document.dto';
import type { UpdateDocumentDto } from './dto/update-document.dto';
import { type Document, getDocumentAccessLevel } from './entities/document.entity';

@Injectable()
export class DocumentUploadService {
  private readonly logger = new Logger(DocumentUploadService.name);

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly r2Service: CloudflareR2Service,
    private readonly fileService: FileService,
    private readonly auditLogsService: AuditLogsService,
    private readonly managerAccessService: ManagerAccessService,
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

  async getDocumentsByMemberId(
    memberId: string,
    tenantId: string,
    memberRole?: string,
  ): Promise<Document[]> {
    const documents = await this.documentRepository.getDocumentsByMemberId(memberId, tenantId);
    return this.filterDocumentsForMember(documents, memberRole);
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

  async purgeExpiredDocument(document: Document): Promise<void> {
    await this.purgeStoredFile(document);
    await this.documentRepository.delete(document.id);
  }

  private async purgeStoredFile(document: Document): Promise<void> {
    if (!document.fileKey?.trim()) {
      return;
    }

    try {
      await this.r2Service.deleteFile(document.fileKey);
    } catch (error) {
      this.logger.warn(
        `Failed to delete R2 object for document ${document.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async restoreDocument(id: string, tenantId: string): Promise<Document> {
    await this.documentRepository.restoreDocument(id, tenantId);
    return this.getDocument(id, tenantId);
  }

  async getDocumentsByType(type: DocumentType, tenantId: string): Promise<Document[]> {
    return this.documentRepository.getDocumentsByType(type, tenantId);
  }

  async getEmployeeDocumentsByType(
    memberId: string,
    type: DocumentType,
    tenantId: string,
    memberRole?: string,
  ): Promise<Document[]> {
    const documents = await this.documentRepository.getDocumentsByMemberId(memberId, tenantId);
    const filtered = documents.filter((doc) => doc.type === type);
    return this.filterDocumentsForMember(filtered, memberRole);
  }

  async getDocumentsByTypes(types: DocumentType[], tenantId: string): Promise<Document[]> {
    return this.documentRepository.getDocumentsByTypes(types, tenantId);
  }

  async getDocumentsByCategory(category: DocumentCategory, tenantId: string): Promise<Document[]> {
    return this.documentRepository.getDocumentsByCategory(category, tenantId);
  }

  async getDocumentsByAccessLevel(
    accessLevel: DocumentAccessLevel,
    tenantId: string,
  ): Promise<Document[]> {
    return this.documentRepository.getDocumentsByAccessLevel(accessLevel, tenantId);
  }

  filterDocumentsForMember(documents: Document[], memberRole?: string): Document[] {
    if (!memberRole || this.isPrivilegedDocumentRole(memberRole)) {
      return documents;
    }
    return documents.filter(
      (document) => !(document.type === DocumentType.PAY_STUB && !document.isVerified),
    );
  }

  private isPrivilegedDocumentRole(memberRole: string): boolean {
    const role = memberRole.toLowerCase();
    return role === 'admin' || role === 'owner';
  }

  async checkDocumentAccess(
    tenantId: string,
    documentId: string,
    memberId: string,
    memberRole: string,
  ): Promise<boolean> {
    const document = await this.getDocument(documentId, tenantId);
    const isPrivileged = this.isPrivilegedDocumentRole(memberRole);

    if (document.type === DocumentType.PAY_STUB && !document.isVerified && !isPrivileged) {
      const isManager = await this.managerAccessService.isManagerOf(
        tenantId,
        memberId,
        document.tenantMemberId,
      );
      if (!isManager) {
        return false;
      }
    }

    if (isPrivileged) {
      return true;
    }

    const isManager = await this.managerAccessService.isManagerOf(
      tenantId,
      memberId,
      document.tenantMemberId,
    );
    if (isManager) {
      return true;
    }

    const accessLevel = getDocumentAccessLevel(document.type);
    switch (accessLevel) {
      case DocumentAccessLevel.PUBLIC:
        return true;
      case DocumentAccessLevel.EMPLOYEE_ONLY:
        return document.tenantMemberId === memberId;
      case DocumentAccessLevel.MANAGEMENT:
      case DocumentAccessLevel.HR_ONLY:
        return false;
      case DocumentAccessLevel.ADMIN_ONLY:
        return false;
      default:
        return document.tenantMemberId === memberId;
    }
  }

  async downloadDocument(
    tenantId: string,
    id: string,
    memberId?: string,
    memberRole?: string,
  ): Promise<string> {
    const document = await this.getDocument(id, tenantId);
    if (memberId && memberRole) {
      const hasAccess = await this.checkDocumentAccess(tenantId, id, memberId, memberRole);
      if (!hasAccess) {
        throw new NotFoundException(`Document with ID "${id}" not found`);
      }
    }
    return this.fileService.generateDownloadUrl(
      tenantId,
      FileUploadLocation.DOCUMENTS,
      document.fileKey,
      undefined,
      document.name,
    );
  }

  getDocumentsByVerificationStatus(tenantId: string, isVerified: boolean) {
    return this.documentRepository.getDocumentsByVerificationStatus(tenantId, isVerified);
  }

  getExpiringDocuments(tenantId: string, days: number) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return this.documentRepository.getExpiringDocuments(tenantId, futureDate);
  }
}
