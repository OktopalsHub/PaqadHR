import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GenerateUploadUrlDto } from '../dto/generate-upload-url.dto';
import { FileService } from '../services/file.service';
import { TenantMemberGuard } from '../../modules/v1/tenant-members/guards/tenant-members.guards';

@ApiTags('files')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/files')
export class FilesController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a presigned upload URL for R2' })
  async generateUploadUrl(
    @Param('tenantId') tenantId: string,
    @Body() body: GenerateUploadUrlDto,
  ) {
    return this.fileService.generateUploadUrl({
      tenantId,
      location: body.location,
      originalName: body.originalName,
      contentType: body.contentType,
    });
  }
}
