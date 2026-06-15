import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FileUploadLocation } from 'src/common/enums/file-upload-location.enum';
import { FileService } from 'src/common/services/file.service';
import { Repository } from 'typeorm';
import type { CreateAssetDocumentDto } from './dto/create-asset-document.dto';
import type { UpdateAssetDocumentDto } from './dto/update-asset-document.dto';
import { AssetDocument } from './entities/asset-document.entity';

@Injectable()
export class AssetDocumentService {
  constructor(
    @InjectRepository(AssetDocument)
    private readonly assetDocumentRepository: Repository<AssetDocument>,
    private readonly fileService: FileService,
  ) {}
  async createAssetDocument(tenantId: string, createAssetDocumentDto: CreateAssetDocumentDto) {
    const assetDocument = this.assetDocumentRepository.create({
      ...createAssetDocumentDto,
      tenantId,
    });
    return this.assetDocumentRepository.save(assetDocument);
  }
  listAssetDocuments(tenantId: string) {
    return this.assetDocumentRepository.find({
      where: { tenantId },
    });
  }
  getAssetDocument(tenantId: string, id: string) {
    return this.assetDocumentRepository.findOne({
      where: { id, tenantId },
    });
  }
  updateAssetDocument(
    tenantId: string,
    id: string,
    updateAssetDocumentDto: UpdateAssetDocumentDto,
  ) {
    return this.assetDocumentRepository.update({ id, tenantId }, updateAssetDocumentDto);
  }
  deleteAssetDocument(tenantId: string, id: string) {
    return this.assetDocumentRepository.delete({ id, tenantId });
  }
  async downloadAssetDocument(tenantId: string, id: string): Promise<string> {
    const document = await this.getAssetDocument(tenantId, id);
    if (!document) {
      throw new NotFoundException('Asset document not found');
    }
    return this.fileService.generateDownloadUrl(
      tenantId,
      FileUploadLocation.ASSETS,
      document.imageKey,
      undefined,
      document.documentName,
    );
  }
}
