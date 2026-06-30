import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileUrlService } from 'src/common/services/file-url.service';
import { AssetDocumentService } from './asset-document.service';
import { AssetDocumentMapper } from './dto/asset-document-response.dto';
import type { CreateAssetDocumentDto } from './dto/create-asset-document.dto';
import type { UpdateAssetDocumentDto } from './dto/update-asset-document.dto';

@ApiTags('Assets')
@Controller('tenants/:tenantId/asset-documents')
export class AssetDocumentController {
  constructor(
    private readonly assetDocumentService: AssetDocumentService,
    readonly _fileUrlService: FileUrlService,
  ) {}
  @Post()
  createAssetDocument(
    @Param('tenantId') tenantId: string,
    @Body() createAssetDocumentDto: CreateAssetDocumentDto,
  ) {
    return this.assetDocumentService.createAssetDocument(tenantId, createAssetDocumentDto);
  }
  @Get()
  async listAssetDocuments(@Param('tenantId') tenantId: string) {
    const documents = await this.assetDocumentService.listAssetDocuments(tenantId);
    return AssetDocumentMapper.toResponseList(documents);
  }
  @Get(':id')
  async getAssetDocument(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    const document = await this.assetDocumentService.getAssetDocument(tenantId, id);
    if (!document) {
      throw new NotFoundException('Asset document not found');
    }
    return AssetDocumentMapper.toResponse(document);
  }
  @Patch(':id')
  updateAssetDocument(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() updateAssetDocumentDto: UpdateAssetDocumentDto,
  ) {
    return this.assetDocumentService.updateAssetDocument(tenantId, id, updateAssetDocumentDto);
  }
  @Get(':id/download')
  async downloadAssetDocument(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    const downloadUrl = await this.assetDocumentService.downloadAssetDocument(tenantId, id);
    return { downloadUrl };
  }
  @Delete(':id')
  deleteAssetDocument(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.assetDocumentService.deleteAssetDocument(tenantId, id);
  }
}
