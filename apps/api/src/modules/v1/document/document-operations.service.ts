import { Injectable, NotImplementedException } from '@nestjs/common';
import type { DocumentCategory } from '../../../common/enums/document-category.enum';
import { DocumentType } from '../../../common/enums/document-type.enum';
import { DocumentRepository } from './document.repository';
import { DocumentCrudService } from './document-crud.service';
import type { Document } from './entities/document.entity';

@Injectable()
export class DocumentOperationsService {
  constructor(
    private readonly documentCrudService: DocumentCrudService,
    private readonly documentRepository: DocumentRepository,
  ) {}

  async verifyDocument(id: string, tenantId: string, isVerified: boolean): Promise<Document> {
    return this.documentCrudService.updateDocument(id, { isVerified }, tenantId);
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
        await this.documentCrudService.deleteDocument(documentId, tenantId);
      } catch {}
    }
  }

  async getDocumentAccessLogs(tenantId: string, documentId: string): Promise<unknown[]> {
    await this.documentCrudService.getDocument(documentId, tenantId);
    throw new NotImplementedException('Document access logs are not available yet');
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
    await this.documentCrudService.getDocument(documentId, tenantId);
    throw new NotImplementedException('Digital signatures are not available yet');
  }

  async getDocumentStatistics(tenantId: string): Promise<unknown> {
    const allDocuments = await this.documentCrudService.listDocuments(tenantId);
    const stats = {
      total: allDocuments.length,
      byCategory: {} as Record<DocumentCategory, number>,
      byType: {} as Record<DocumentType, number>,
      expiringSoon: 0,
      unverified: 0,
    };
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const { getDocumentCategory } = require('./entities/document.entity');
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
