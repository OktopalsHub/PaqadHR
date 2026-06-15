import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { DocumentType } from '../../../common/enums/document-type.enum';
import type { IDocumentRepository } from '../../../common/interfaces/idocument-repository.interface';
import { Document, getDocumentAccessLevel, getDocumentCategory } from './entities/document.entity';

@Injectable()
export class DocumentRepository extends Repository<Document> implements IDocumentRepository {
  constructor(
    @InjectRepository(Document)
    repository: Repository<Document>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }
  async createDocument(
    createDocumentDto: Partial<Document>,
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Document> {
    return this.create({
      ...createDocumentDto,
      tenantId,
      tenantMemberId,
    });
  }
  async listDocuments(tenantId: string): Promise<Document[]> {
    return this.find({ withDeleted: false, where: { tenantId } });
  }
  async getDocument(id: string, tenantId: string): Promise<Document | null> {
    return this.findOne({ where: { id, tenantId }, withDeleted: false });
  }
  async getDocumentsByMemberId(memberId: string, tenantId: string): Promise<Document[]> {
    return this.find({
      withDeleted: false,
      where: { tenantMemberId: memberId, tenantId },
    });
  }
  async getDocumentsByType(type: DocumentType, tenantId: string): Promise<Document[]> {
    return this.find({ withDeleted: false, where: { type, tenantId } });
  }
  async updateDocument(
    id: string,
    updateDocumentDto: Partial<Document>,
    tenantId: string,
  ): Promise<Document> {
    await this.update(id, updateDocumentDto as Parameters<typeof this.update>[1]);
    const updatedDocument = await this.getDocument(id, tenantId);
    if (!updatedDocument) {
      throw new NotFoundException(`Document with ID "${id}" not found after update`);
    }
    return updatedDocument;
  }
  async softDeleteDocument(id: string, tenantId: string): Promise<void> {
    const result = await this.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Document with ID "${id}" not found`);
    }
  }
  async deleteDocument(id: string, tenantId: string): Promise<void> {
    await this.softDeleteDocument(id, tenantId);
  }
  async restoreDocument(id: string, tenantId: string): Promise<void> {
    throw new NotFoundException('Document restoration not supported');
  }
  async getDocumentsByVerificationStatus(
    tenantId: string,
    isVerified: boolean,
  ): Promise<Document[]> {
    return this.find({ withDeleted: false, where: { tenantId, isVerified } });
  }
  async getExpiringDocuments(tenantId: string, expiryDate: Date): Promise<Document[]> {
    return this.createQueryBuilder('document')
      .where('document.tenantId = :tenantId', { tenantId })
      .andWhere('document.expiryDate IS NOT NULL')
      .andWhere('document.expiryDate <= :expiryDate', { expiryDate })
      .andWhere('document.expiryDate > :now', { now: new Date() })
      .orderBy('document.expiryDate', 'ASC')
      .getMany();
  }
  async getDocumentsByTypes(types: DocumentType[], tenantId: string): Promise<Document[]> {
    return this.find({
      withDeleted: false,
      where: {
        tenantId,
        type: In(types),
      },
    });
  }
  async getDocumentsByCategory(category: string, tenantId: string): Promise<Document[]> {
    const allDocuments = await this.listDocuments(tenantId);
    return allDocuments.filter((doc) => {
      const docCategory = getDocumentCategory(doc.type);
      return docCategory === category;
    });
  }
  async getDocumentsByAccessLevel(accessLevel: string, tenantId: string): Promise<Document[]> {
    const allDocuments = await this.listDocuments(tenantId);
    return allDocuments.filter((doc) => {
      const docAccessLevel = getDocumentAccessLevel(doc.type);
      return docAccessLevel === accessLevel;
    });
  }
}
