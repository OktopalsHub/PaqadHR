import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { DocumentUploadService } from './document-upload.service';
import { DocumentVerificationService } from './document-verification.service';
import { Document } from './entities/document.entity';

@ApiTags('Documents')
@Controller('tenants/:tenantId/documents')
@UseGuards(TenantMemberGuard)
@RequireFeatures(FeatureAccess.EMPLOYEE_SELF_SERVICE)
export class DocumentVerifyController {
  constructor(
    private readonly documentVerificationService: DocumentVerificationService,
    private readonly documentUploadService: DocumentUploadService,
  ) {}

  @Get('templates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get available document templates' })
  async getDocumentTemplates(@Param('tenantId') tenantId: string) {
    return this.documentVerificationService.getDocumentTemplates(tenantId);
  }

  @Get('statistics/overview')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get document statistics and insights' })
  async getDocumentStatistics(@Param('tenantId') tenantId: string) {
    return this.documentVerificationService.getDocumentStatistics(tenantId);
  }

  @Post('bulk/verify')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk verify multiple documents' })
  async bulkVerifyDocuments(
    @Param('tenantId') tenantId: string,
    @Body() body: { documentIds: string[]; isVerified: boolean },
    @CurrentTenantMember() member: MemberContext,
  ): Promise<Document[]> {
    return this.documentVerificationService.bulkVerifyDocuments(
      tenantId,
      body.documentIds,
      body.isVerified,
      member.id,
    );
  }

  @Post('bulk/delete')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk soft delete multiple documents' })
  async bulkDeleteDocuments(
    @Param('tenantId') tenantId: string,
    @Body() body: { documentIds: string[] },
  ): Promise<void> {
    return this.documentVerificationService.bulkDeleteDocuments(tenantId, body.documentIds);
  }

  @Post(':id/verify')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async verifyDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
    @Query('isVerified', ParseBoolPipe) isVerified: boolean,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<Document> {
    return this.documentVerificationService.verifyDocument(id, tenantId, isVerified, member.id);
  }

  @Post(':id/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate digital signature process' })
  async initiateDigitalSignature(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
    @Body() body: { signerEmails: string[] },
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
    return this.documentVerificationService.initiateDigitalSignature(
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
    return this.documentVerificationService.getDocumentAccessLogs(tenantId, id);
  }

  @Post(':id/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log document access for audit trail' })
  async logDocumentAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tenantId') tenantId: string,
    @Body() body: { memberId: string; action: string },
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
    return this.documentVerificationService.logDocumentAccess(
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
    @CurrentTenantMember() member: MemberContext,
  ) {
    const hasAccess = await this.documentUploadService.checkDocumentAccess(
      tenantId,
      id,
      member.id,
      member.role,
    );
    return { hasAccess };
  }
}
