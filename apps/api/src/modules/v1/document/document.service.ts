import { Injectable, NotFoundException } from '@nestjs/common';
import { FileUploadLocation } from 'src/common/enums/file-upload-location.enum';
import { CloudflareR2Service } from 'src/common/services/cloudflare-r2.service';
import { FileService } from 'src/common/services/file.service';
import { DocumentAccessLevel } from '../../../common/enums/document-access-level.enum';
import type { DocumentCategory } from '../../../common/enums/document-category.enum';
import { DocumentType } from '../../../common/enums/document-type.enum';
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
  constructor(
    private readonly documentRepository: DocumentRepository,
    readonly _r2Service: CloudflareR2Service,
    private readonly fileService: FileService,
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
  ): Promise<Document> {
    await this.getDocument(id, tenantId);
    return this.documentRepository.updateDocument(id, updateDocumentDto, tenantId);
  }
  async deleteDocument(id: string, tenantId: string): Promise<void> {
    await this.documentRepository.softDeleteDocument(id, tenantId);
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
  ): Promise<Document[]> {
    await this.getDocument(memberId, tenantId);
    const documents = await this.documentRepository.getDocumentsByType(type, tenantId);
    return documents.filter((doc) => doc.tenantMemberId === memberId);
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
      } catch (error) {
        console.error(`Failed to verify document ${documentId}:`, error);
      }
    }
    return updatedDocuments;
  }
  async bulkDeleteDocuments(tenantId: string, documentIds: string[]): Promise<void> {
    for (const documentId of documentIds) {
      try {
        await this.deleteDocument(documentId, tenantId);
      } catch (error) {
        console.error(`Failed to delete document ${documentId}:`, error);
      }
    }
  }
  async getDocumentAccessLogs(tenantId: string, documentId: string): Promise<unknown[]> {
    await this.getDocument(documentId, tenantId);
    return [];
  }
  async logDocumentAccess(
    tenantId: string,
    documentId: string,
    memberId: string,
    action: string,
  ): Promise<void> {
    await this.getDocument(documentId, tenantId);
    console.log(`Document ${documentId} accessed by member ${memberId}: ${action}`);
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
    const _document = await this.getDocument(documentId, tenantId);
    return {
      documentId,
      status: 'pending',
      signers: signerEmails.map((email) => ({ email, status: 'sent' })),
      signatureUrl: `https://signature-service.com/sign/${documentId}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
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
  async checkDocumentAccess(
    tenantId: string,
    documentId: string,
    memberId: string,
    memberRole: string,
  ): Promise<boolean> {
    const document = await this.getDocument(documentId, tenantId);
    if (memberRole === 'admin' || memberRole === 'hr') {
      return true;
    }
    const accessLevel = getDocumentAccessLevel(document.type);
    switch (accessLevel) {
      case DocumentAccessLevel.PUBLIC:
        return true;
      case DocumentAccessLevel.EMPLOYEE_ONLY:
        return document.tenantMemberId === memberId;
      case DocumentAccessLevel.MANAGEMENT:
        return ['admin', 'hr', 'manager'].includes(memberRole);
      case DocumentAccessLevel.HR_ONLY:
        return ['admin', 'hr'].includes(memberRole);
      case DocumentAccessLevel.ADMIN_ONLY:
        return memberRole === 'admin';
      default:
        return document.tenantMemberId === memberId;
    }
  }
  async downloadDocument(tenantId: string, id: string): Promise<string> {
    const document = await this.getDocument(id, tenantId);
    return this.fileService.generateDownloadUrl(
      tenantId,
      FileUploadLocation.DOCUMENTS,
      document.fileKey,
      undefined,
      document.name,
    );
  }
}
