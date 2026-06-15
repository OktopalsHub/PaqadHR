import {
  Body,
  Controller,
  Delete,
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
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import type { CreateEducationDto } from './dto/create-education.dto';
import type { UpdateEducationDto } from './dto/update-education.dto';
import type { EducationService } from './education.service';
import type { Education } from './entities/education.entity';

@ApiTags('education')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/education')
export class EducationController {
  constructor(private readonly educationService: EducationService) {}
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEducation(
    @Param('tenantId') tenantId: string,
    @Body() createEducationDto: CreateEducationDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<Education> {
    const { memberId, ...educationData } = createEducationDto;
    return this.educationService.createEducation(tenantId, memberId ?? member.id, educationData);
  }
  @Get()
  @HttpCode(HttpStatus.OK)
  async getEducations(
    @Param('tenantId') tenantId: string,
    @Query('memberId') memberId?: string,
  ): Promise<Education[]> {
    if (memberId) {
      return this.educationService.getEducationsByMemberId(memberId, tenantId);
    }
    return this.educationService.listEducations(tenantId);
  }
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getEducation(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Education> {
    return this.educationService.getEducation(id, tenantId);
  }
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateEducation(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEducationDto: UpdateEducationDto,
  ): Promise<Education> {
    return this.educationService.updateEducation(id, updateEducationDto, tenantId);
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEducation(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.educationService.deleteEducation(id, tenantId);
  }
}
