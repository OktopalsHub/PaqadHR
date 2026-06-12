import { Document } from './entities/document.entity';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards } from '@nestjs/common';
import { MemberContext } from 'src/common/interfaces';
import { CurrentTenantMember } from 'src/common/decorators';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileUrlService } from 'src/common/services/file-url.service';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from "./dto/create-document.dto";
import { TenantMember } from "../tenant-members/entities/tenant-member.entity";
import { DocumentMapper } from "./dto/document-response.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { DocumentType } from "../../../common/enums/document-type.enum";
import { DocumentCategory } from "../../../common/enums/document-category.enum";
import { DocumentAccessLevel } from "../../../common/enums/document-access-level.enum";

@ApiTags('documents')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/documents')
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly fileUrlService: FileUrlService,
  ) {}
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create document record',
    description: `Step 1: Call POST /files/upload-url with { location: "documents", originalName: "file.pdf" }
Step 2: Upload file to the returned uploadUrl
Step 3: Call this endpoint with the fileKey from step 1`,
  })
  @ApiResponse({
    status: 201,
    description: 'Document record created successfully',
    type: Document,
  })
  async createDocument(
    @Body() createDocumentDto: CreateDocumentDto,
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext
    ): Promise<Document> {
    return this.documentService.createDocument(
      tenantId,
      member.id,
      createDocumentDto,
    );
  }
  @Get()
  @HttpCode(HttpStatus.OK)
  async getDocuments(
    @Param('tenantId') tenantId: string,
    @Query('memberId') memberId?: string,
    @Query('types') types?: string, 
    @Query('category') category?: DocumentCategory,
    @Query('isVerified') isVerified?: boolean,
    @Query('expiringWithinDays') expiringWithinDays?: number,
    @Query('accessLevel') accessLevel?: DocumentAccessLevel,
  ) {
    let documents: Document[];
    let parsedTypes: DocumentType[] | undefined;
    if (types) {
      parsedTypes = types.split(',').map((t) => t.trim() as DocumentType);
    }
    if (memberId && parsedTypes && parsedTypes.length === 1) {
      documents = await this.documentService.getEmployeeDocumentsByType(
        memberId,
        parsedTypes[0],
        tenantId,
      );
    } else if (memberId) {
      documents = await this.documentService.getDocumentsByMemberId(
        memberId,
        tenantId,
      );
    } else if (parsedTypes && parsedTypes.length === 1) {
      documents = await this.documentService.getDocumentsByType(
        parsedTypes[0],
        tenantId,
      );
    } else if (parsedTypes && parsedTypes.length > 1) {
      documents = await this.documentService.getDocumentsByTypes(
        parsedTypes,
        tenantId,
      );
    } else if (category) {
      documents = await this.documentService.getDocumentsByCategory(
        category,
        tenantId,
      );
    } else if (isVerified !== undefined) {
      documents = await this.documentService.getDocumentsByVerificationStatus(
        tenantId,
        isVerified,
      );
    } else if (expiringWithinDays) {
      documents = await this.documentService.getExpiringDocuments(
        tenantId,
        expiringWithinDays,
      );
    } else if (accessLevel) {
      documents = await this.documentService.getDocumentsByAccessLevel(
        accessLevel,
        tenantId,
      );
    } else {
      documents = await this.documentService.listDocuments(tenantId);
    }
    return DocumentMapper.toResponseList(documents, this.fileUrlService);
  }
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
  ) {
    const document = await this.documentService.getDocument(id, tenantId);
    return DocumentMapper.toResponse(document, this.fileUrlService);
  }
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ): Promise<Document> {
    return this.documentService.updateDocument(id, updateDocumentDto, tenantId);
  }
  @Get(':id/download')
  @HttpCode(HttpStatus.OK)
  async downloadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
  ) {
    const downloadUrl = await this.documentService.downloadDocument(
      tenantId,
      id,
    );
    return { downloadUrl };
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
  ): Promise<void> {
    await this.documentService.deleteDocument(id, tenantId);
  }
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  async restoreDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
  ): Promise<Document> {
    return this.documentService.restoreDocument(id, tenantId);
  }
  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  async verifyDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
    @Query('isVerified', ParseBoolPipe) isVerified: boolean,
  ): Promise<Document> {
    return this.documentService.verifyDocument(id, tenantId, isVerified);
  }
  @Post('bulk/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk verify multiple documents' })
  async bulkVerifyDocuments(
    @Param('tenantId') tenantId: string,
    @Body() body: { documentIds: string[]; isVerified: boolean },
  ): Promise<Document[]> {
    return this.documentService.bulkVerifyDocuments(
      tenantId,
      body.documentIds,
      body.isVerified,
    );
  }
  @Post('bulk/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk soft delete multiple documents' })
  async bulkDeleteDocuments(
    @Param('tenantId') tenantId: string,
    @Body() body: { documentIds: string[] },
  ): Promise<void> {
    return this.documentService.bulkDeleteDocuments(tenantId, body.documentIds);
  }
  @Get('templates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get available document templates' })
  async getDocumentTemplates(@Param('tenantId') tenantId: string) {
    return this.documentService.getDocumentTemplates(tenantId);
  }
  @Post(':id/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate digital signature process' })
  async initiateDigitalSignature(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
    @Body() body: { signerEmails: string[] },
  ) {
    return this.documentService.initiateDigitalSignature(
      tenantId,
      id,
      body.signerEmails,
    );
  }
  @Get(':id/access-logs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get document access logs for audit trail' })
  async getDocumentAccessLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
  ) {
    return this.documentService.getDocumentAccessLogs(tenantId, id);
  }
  @Post(':id/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log document access for audit trail' })
  async logDocumentAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
    @Body() body: { memberId: string; action: string },
    @CurrentTenantMember() member: MemberContext
    ) {
    const hasAccess = await this.documentService.checkDocumentAccess(
      tenantId,
      id,
      member.id,
      member.role,
    );
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this document');
    }
    return this.documentService.logDocumentAccess(
      tenantId,
      id,
      body.memberId,
      body.action,
    );
  }
  @Get(':id/access-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if current user has access to document' })
  async checkDocumentAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext
    ) {
    const hasAccess = await this.documentService.checkDocumentAccess(
      tenantId,
      id,
      member.id,
      member.role,
    );
    return { hasAccess };
  }
  @Get('statistics/overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get document statistics and insights' })
  async getDocumentStatistics(@Param('tenantId') tenantId: string) {
    return this.documentService.getDocumentStatistics(tenantId);
  }
}
