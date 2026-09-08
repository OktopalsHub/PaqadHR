import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { DocumentType } from 'src/common/enums/document-type.enum';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { FileUrlService } from 'src/common/services/file-url.service';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { assertAdmin, isTenantAdmin } from 'src/common/utils/member-access.util';
import type { DocumentAccessLevel } from '../../../common/enums/document-access-level.enum';
import type { DocumentCategory } from '../../../common/enums/document-category.enum';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { DocumentUploadService } from './document-upload.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentMapper } from './dto/document-response.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { Document } from './entities/document.entity';

@ApiTags('Documents')
@Controller('tenants/:tenantId/documents')
@UseGuards(TenantMemberGuard)
@RequireFeatures(FeatureAccess.EMPLOYEE_SELF_SERVICE)
export class DocumentUploadController {
  constructor(
    private readonly documentUploadService: DocumentUploadService,
    private readonly fileUrlService: FileUrlService,
    private readonly managerAccessService: ManagerAccessService,
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
    @CurrentTenantMember() member: MemberContext,
  ): Promise<Document> {
    if (createDocumentDto.type === DocumentType.PAY_STUB) {
      throw new BadRequestException('Payslips cannot be uploaded manually');
    }

    const targetMemberId = createDocumentDto.memberId ?? member.id;

    if (targetMemberId !== member.id && !isTenantAdmin(member)) {
      await this.managerAccessService.assertAdminOrManagerOf(member, targetMemberId, tenantId);
    }

    const { memberId: _memberId, ...documentPayload } = createDocumentDto;

    return this.documentUploadService.createDocument(tenantId, targetMemberId, documentPayload);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getDocuments(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
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
    if (memberId) {
      await this.managerAccessService.assertAdminOrSelfOrManagerOf(member, memberId, tenantId);
      if (parsedTypes && parsedTypes.length === 1) {
        documents = await this.documentUploadService.getEmployeeDocumentsByType(
          memberId,
          parsedTypes[0],
          tenantId,
          member.role,
        );
      } else {
        documents = await this.documentUploadService.getDocumentsByMemberId(
          memberId,
          tenantId,
          member.role,
        );
      }
    } else {
      assertAdmin(member);
      if (parsedTypes && parsedTypes.length === 1) {
        documents = await this.documentUploadService.getDocumentsByType(parsedTypes[0], tenantId);
      } else if (parsedTypes && parsedTypes.length > 1) {
        documents = await this.documentUploadService.getDocumentsByTypes(parsedTypes, tenantId);
      } else if (category) {
        documents = await this.documentUploadService.getDocumentsByCategory(category, tenantId);
      } else if (isVerified !== undefined) {
        documents = await this.documentUploadService.getDocumentsByVerificationStatus(
          tenantId,
          isVerified,
        );
      } else if (expiringWithinDays) {
        documents = await this.documentUploadService.getExpiringDocuments(
          tenantId,
          expiringWithinDays,
        );
      } else if (accessLevel) {
        documents = await this.documentUploadService.getDocumentsByAccessLevel(
          accessLevel,
          tenantId,
        );
      } else {
        documents = await this.documentUploadService.listDocuments(tenantId);
      }
    }
    documents = this.documentUploadService.filterDocumentsForMember(documents, member.role);
    return DocumentMapper.toResponseList(documents, this.fileUrlService);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const hasAccess = await this.documentUploadService.checkDocumentAccess(
      tenantId,
      id,
      member.id,
      member.role,
    );
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this document');
    }
    const document = await this.documentUploadService.getDocument(id, tenantId);
    return DocumentMapper.toResponse(document, this.fileUrlService);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<Document> {
    const document = await this.documentUploadService.getDocument(id, tenantId);
    if (document.tenantMemberId !== member.id && !isTenantAdmin(member)) {
      await this.managerAccessService.assertAdminOrManagerOf(
        member,
        document.tenantMemberId,
        tenantId,
      );
    }
    return this.documentUploadService.updateDocument(id, updateDocumentDto, tenantId, member.id);
  }

  @Get(':id/download')
  @HttpCode(HttpStatus.OK)
  async downloadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const downloadUrl = await this.documentUploadService.downloadDocument(
      tenantId,
      id,
      member.id,
      member.role,
    );
    return { downloadUrl };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<void> {
    const document = await this.documentUploadService.getDocument(id, tenantId);
    if (document.tenantMemberId !== member.id && !isTenantAdmin(member)) {
      await this.managerAccessService.assertAdminOrManagerOf(
        member,
        document.tenantMemberId,
        tenantId,
      );
    }
    await this.documentUploadService.deleteDocument(id, tenantId, member.id);
  }

  @Post(':id/restore')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async restoreDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
  ): Promise<Document> {
    return this.documentUploadService.restoreDocument(id, tenantId);
  }
}
