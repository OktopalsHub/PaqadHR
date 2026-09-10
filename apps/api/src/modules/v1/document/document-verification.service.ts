import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { AuditAction, AuditSeverity, AuditStatus } from 'src/common/enums/audit-action.enum';
import type { DocumentCategory } from '../../../common/enums/document-category.enum';
import { DocumentType } from '../../../common/enums/document-type.enum';
import { AuditLogsService } from '../audit-logs/services/audit-logs.service';
import { NotificationHelperService } from '../notifications/services/notification-helper.service';
import { DocumentRepository } from './document.repository';
import { DocumentUploadService } from './document-upload.service';
import type { Document } from './entities/document.entity';
import { getDocumentCategory } from './entities/document.entity';

@Injectable()
export class DocumentVerificationService {
  private readonly logger = new Logger(DocumentVerificationService.name);

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationHelperService: NotificationHelperService,
    private readonly documentUploadService: DocumentUploadService,
  ) {}

  async verifyDocument(
    id: string,
    tenantId: string,
    isVerified: boolean,
    actorMemberId?: string,
  ): Promise<Document> {
    const doc = await this.documentUploadService.getDocument(id, tenantId);
    const updated = await this.documentUploadService.updateDocument(id, { isVerified }, tenantId);

    if (isVerified) {
      void this.notificationHelperService
        .sendDocumentApprovalNotification(doc.tenantMemberId, tenantId, {
          documentName: doc.name,
          status: 'approved',
          reviewerName: actorMemberId ?? 'Admin',
        })
        .catch((error) => {
          this.logger.error('Failed to send document approval notification', error);
        });
    }

    return updated;
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
    actorMemberId?: string,
  ): Promise<Document[]> {
    const updatedDocuments: Document[] = [];
    for (const documentId of documentIds) {
      try {
        const updatedDoc = await this.verifyDocument(
          documentId,
          tenantId,
          isVerified,
          actorMemberId,
        );
        updatedDocuments.push(updatedDoc);
      } catch {}
    }
    return updatedDocuments;
  }

  async bulkDeleteDocuments(tenantId: string, documentIds: string[]): Promise<void> {
    for (const documentId of documentIds) {
      try {
        await this.documentUploadService.deleteDocument(documentId, tenantId);
      } catch {}
    }
  }

  async getDocumentAccessLogs(tenantId: string, documentId: string): Promise<unknown[]> {
    await this.documentUploadService.getDocument(documentId, tenantId);
    throw new NotImplementedException('Document access logs are not available yet');
  }

  async logDocumentAccess(
    tenantId: string,
    documentId: string,
    memberId: string,
    action: string,
  ): Promise<void> {
    await this.documentUploadService.getDocument(documentId, tenantId);
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
    await this.documentUploadService.getDocument(documentId, tenantId);
    throw new NotImplementedException('Digital signatures are not available yet');
  }

  async getDocumentStatistics(tenantId: string): Promise<unknown> {
    const allDocuments = await this.documentUploadService.listDocuments(tenantId);
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
}
