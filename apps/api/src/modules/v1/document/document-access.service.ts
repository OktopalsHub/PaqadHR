import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditSeverity, AuditStatus } from 'src/common/enums/audit-action.enum';
import { FileUploadLocation } from 'src/common/enums/file-upload-location.enum';
import { CloudflareR2Service } from 'src/common/services/cloudflare-r2.service';
import { FileService } from 'src/common/services/file.service';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { DocumentAccessLevel } from '../../../common/enums/document-access-level.enum';
import { DocumentType } from '../../../common/enums/document-type.enum';
import { AuditLogsService } from '../audit-logs/services/audit-logs.service';
import { DocumentRepository } from './document.repository';
import { DocumentCrudService } from './document-crud.service';
import type { Document } from './entities/document.entity';
import { getDocumentAccessLevel } from './entities/document.entity';

@Injectable()
export class DocumentAccessService {
  private readonly logger = new Logger(DocumentAccessService.name);

  constructor(
    private readonly documentCrudService: DocumentCrudService,
    private readonly documentRepository: DocumentRepository,
    private readonly r2Service: CloudflareR2Service,
    private readonly fileService: FileService,
    private readonly auditLogsService: AuditLogsService,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  async getDocumentsByMemberId(
    memberId: string,
    tenantId: string,
    memberRole?: string,
  ): Promise<Document[]> {
    const documents = await this.documentCrudService.getDocumentsByMemberId(memberId, tenantId);
    return this.filterDocumentsForMember(documents, memberRole);
  }

  async getEmployeeDocumentsByType(
    memberId: string,
    type: DocumentType,
    tenantId: string,
    memberRole?: string,
  ): Promise<Document[]> {
    const documents = await this.documentCrudService.getDocumentsByMemberId(memberId, tenantId);
    const filtered = documents.filter((doc) => doc.type === type);
    return this.filterDocumentsForMember(filtered, memberRole);
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
    const document = await this.documentCrudService.getDocument(documentId, tenantId);
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
    const document = await this.documentCrudService.getDocument(id, tenantId);
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

  async logDocumentAccess(
    tenantId: string,
    documentId: string,
    memberId: string,
    action: string,
  ): Promise<void> {
    await this.documentCrudService.getDocument(documentId, tenantId);
    await this.auditLogsService.queueAuditLog({
      action: action === 'download' ? AuditAction.FILE_DOWNLOADED : AuditAction.READ,
      description: `Document ${documentId} ${action} by member ${memberId}`,
      severity: AuditSeverity.LOW,
      status: AuditStatus.SUCCESS,
      resourceType: 'document',
      resourceId: documentId,
      tenantId,
      metadata: { memberId, action },
    });
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
}
