import { Injectable, Logger, NotFoundException, NotImplementedException } from '@nestjs/common';
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
import {
  type Document,
  getDocumentAccessLevel,
  getDocumentCategory,
} from './entities/document.entity';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

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
    return this.documentRepository.createDocument(createDocumentDto, tenantId, tenantMemberId);
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
  ): Promise<Document> {
    await this.getDocument(id, tenantId);
    return this.documentRepository.updateDocument(id, updateDocumentDto, tenantId);
  }
  async deleteDocument(id: string, tenantId: string): Promise<void> {
    await this.getDocument(id, tenantId);
    await this.documentRepository.softDeleteDocument(id, tenantId);
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
  async verifyDocument(id: string, tenantId: string, isVerified: boolean): Promise<Document> {
    return this.updateDocument(id, { isVerified }, tenantId);
  }
  async getDocumentsByVerificationStatus(
    tenantId: string,
    isVerified: boolean,
  ): Promise<Document[]> {
    return this.documentRepository.getDocumentsByVerificationStatus(tenantId, isVerified);
  }
  async getExpiringDocuments(tenantId: string, days: number): Promise<Document[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return this.documentRepository.getExpiringDocuments(tenantId, futureDate);
  }
  async bulkVerifyDocuments(
    tenantId: string,
    documentIds: string[],
    isVerified: boolean,
  ): Promise<Document[]> {
    const updatedDocuments: Document[] = [];
    for (const documentId of documentIds) {
      try {
        const updatedDoc = await this.verifyDocument(documentId, tenantId, isVerified);
        updatedDocuments.push(updatedDoc);
      } catch {}
    }
    return updatedDocuments;
  }
  async bulkDeleteDocuments(tenantId: string, documentIds: string[]): Promise<void> {
    for (const documentId of documentIds) {
      try {
        await this.deleteDocument(documentId, tenantId);
      } catch {}
    }
  }
  async getDocumentAccessLogs(tenantId: string, documentId: string): Promise<unknown[]> {
    await this.getDocument(documentId, tenantId);
    throw new NotImplementedException('Document access logs are not available yet');
  }
  async logDocumentAccess(
    tenantId: string,
    documentId: string,
    memberId: string,
    action: string,
  ): Promise<void> {
    await this.getDocument(documentId, tenantId);
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
  async getDocumentTemplates(tenantId: string): Promise<unknown[]> {
    return [
      {
        id: 'offer-letter',
        name: 'Offer Letter',
        type: DocumentType.OFFER_LETTER,
        description: 'Standard employment offer letter template',
      },
      {
        id: 'contract',
        name: 'Employment Contract',
        type: DocumentType.EMPLOYMENT_CONTRACT,
        description: 'Standard employment contract template',
      },
      {
        id: 'nda',
        name: 'Non-Disclosure Agreement',
        type: DocumentType.NON_DISCLOSURE_AGREEMENT,
        description: 'Standard NDA template',
      },
    ];
  }
  async initiateDigitalSignature(
    tenantId: string,
    documentId: string,
    signerEmails: string[],
  ): Promise<unknown> {
    await this.getDocument(documentId, tenantId);
    throw new NotImplementedException('Digital signatures are not available yet');
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
  async getDocumentStatistics(tenantId: string): Promise<unknown> {
    const allDocuments = await this.listDocuments(tenantId);
    const stats = {
      total: allDocuments.length,
      byCategory: {} as Record<DocumentCategory, number>,
      byType: {} as Record<DocumentType, number>,
      expiringSoon: 0,
      unverified: 0,
    };
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    for (const doc of allDocuments) {
      const category = getDocumentCategory(doc.type);
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      stats.byType[doc.type] = (stats.byType[doc.type] || 0) + 1;
      if (doc.expiryDate && doc.expiryDate <= thirtyDaysFromNow && doc.expiryDate > now) {
        stats.expiringSoon++;
      }
      if (!doc.isVerified) {
        stats.unverified++;
      }
    }
    return stats;
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
}
