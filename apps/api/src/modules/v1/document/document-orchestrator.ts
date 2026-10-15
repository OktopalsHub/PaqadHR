import { Injectable } from '@nestjs/common';
import { DocumentUploadService } from './document-upload.service';
import { DocumentVerificationService } from './document-verification.service';

/**
 * Public API for the document module. Delegates to focused sub-services.
 */
@Injectable()
export class DocumentService {
  createDocument: DocumentUploadService['createDocument'];
  listDocuments: DocumentUploadService['listDocuments'];
  getDocumentsByMemberId: DocumentUploadService['getDocumentsByMemberId'];
  getDocument: DocumentUploadService['getDocument'];
  updateDocument: DocumentUploadService['updateDocument'];
  deleteDocument: DocumentUploadService['deleteDocument'];
  purgeExpiredDocument: DocumentUploadService['purgeExpiredDocument'];
  restoreDocument: DocumentUploadService['restoreDocument'];
  getDocumentsByType: DocumentUploadService['getDocumentsByType'];
  getEmployeeDocumentsByType: DocumentUploadService['getEmployeeDocumentsByType'];
  getDocumentsByTypes: DocumentUploadService['getDocumentsByTypes'];
  getDocumentsByCategory: DocumentUploadService['getDocumentsByCategory'];
  getDocumentsByAccessLevel: DocumentUploadService['getDocumentsByAccessLevel'];
  filterDocumentsForMember: DocumentUploadService['filterDocumentsForMember'];
  checkDocumentAccess: DocumentUploadService['checkDocumentAccess'];
  downloadDocument: DocumentUploadService['downloadDocument'];
  verifyDocument: DocumentVerificationService['verifyDocument'];
  getDocumentsByVerificationStatus: DocumentVerificationService['getDocumentsByVerificationStatus'];
  getExpiringDocuments: DocumentVerificationService['getExpiringDocuments'];
  bulkVerifyDocuments: DocumentVerificationService['bulkVerifyDocuments'];
  bulkDeleteDocuments: DocumentVerificationService['bulkDeleteDocuments'];
  getDocumentAccessLogs: DocumentVerificationService['getDocumentAccessLogs'];
  logDocumentAccess: DocumentVerificationService['logDocumentAccess'];
  getDocumentTemplates: DocumentVerificationService['getDocumentTemplates'];
  initiateDigitalSignature: DocumentVerificationService['initiateDigitalSignature'];
  getDocumentStatistics: DocumentVerificationService['getDocumentStatistics'];

  constructor(
    private readonly upload: DocumentUploadService,
    private readonly verification: DocumentVerificationService,
  ) {
    this.createDocument = this.upload.createDocument.bind(this.upload);
    this.listDocuments = this.upload.listDocuments.bind(this.upload);
    this.getDocumentsByMemberId = this.upload.getDocumentsByMemberId.bind(this.upload);
    this.getDocument = this.upload.getDocument.bind(this.upload);
    this.updateDocument = this.upload.updateDocument.bind(this.upload);
    this.deleteDocument = this.upload.deleteDocument.bind(this.upload);
    this.purgeExpiredDocument = this.upload.purgeExpiredDocument.bind(this.upload);
    this.restoreDocument = this.upload.restoreDocument.bind(this.upload);
    this.getDocumentsByType = this.upload.getDocumentsByType.bind(this.upload);
    this.getEmployeeDocumentsByType = this.upload.getEmployeeDocumentsByType.bind(this.upload);
    this.getDocumentsByTypes = this.upload.getDocumentsByTypes.bind(this.upload);
    this.getDocumentsByCategory = this.upload.getDocumentsByCategory.bind(this.upload);
    this.getDocumentsByAccessLevel = this.upload.getDocumentsByAccessLevel.bind(this.upload);
    this.filterDocumentsForMember = this.upload.filterDocumentsForMember.bind(this.upload);
    this.checkDocumentAccess = this.upload.checkDocumentAccess.bind(this.upload);
    this.downloadDocument = this.upload.downloadDocument.bind(this.upload);

    this.verifyDocument = this.verification.verifyDocument.bind(this.verification);
    this.getDocumentsByVerificationStatus = this.verification.getDocumentsByVerificationStatus.bind(
      this.verification,
    );
    this.getExpiringDocuments = this.verification.getExpiringDocuments.bind(this.verification);
    this.bulkVerifyDocuments = this.verification.bulkVerifyDocuments.bind(this.verification);
    this.bulkDeleteDocuments = this.verification.bulkDeleteDocuments.bind(this.verification);
    this.getDocumentAccessLogs = this.verification.getDocumentAccessLogs.bind(this.verification);
    this.logDocumentAccess = this.verification.logDocumentAccess.bind(this.verification);
    this.getDocumentTemplates = this.verification.getDocumentTemplates.bind(this.verification);
    this.initiateDigitalSignature = this.verification.initiateDigitalSignature.bind(
      this.verification,
    );
    this.getDocumentStatistics = this.verification.getDocumentStatistics.bind(this.verification);
  }
}
