import {
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
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import type { MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { assertSelfOnly, isTenantAdmin } from 'src/common/utils/member-access.util';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { EducationService } from './education.service';
import type { Education } from './entities/education.entity';

@ApiTags('Education')
@Controller('tenants/:tenantId/education')
@UseGuards(TenantMemberGuard)
@RequireFeatures(FeatureAccess.EMPLOYEE_SELF_SERVICE)
export class EducationController {
  constructor(
    private readonly educationService: EducationService,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEducation(
    @Param('tenantId') tenantId: string,
    @Body() createEducationDto: CreateEducationDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<Education> {
    const { memberId, ...educationData } = createEducationDto;
    const targetMemberId = memberId ?? member.id;
    assertSelfOnly(member, targetMemberId);
    return this.educationService.createEducation(tenantId, targetMemberId, educationData);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getEducations(
    @Param('tenantId') tenantId: string,
    @Query('memberId') memberId: string | undefined,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<Education[]> {
    if (memberId) {
      await this.managerAccessService.assertAdminOrSelfOrManagerOf(member, memberId, tenantId);
      return this.educationService.getEducationsByMemberId(memberId, tenantId);
    }
    if (isTenantAdmin(member)) {
      return this.educationService.listEducations(tenantId);
    }
    const directReports = await this.managerAccessService.getDirectReportIds(tenantId, member.id);
    if (directReports.length === 0) {
      throw new ForbiddenException('Admin or manager access required');
    }
    const results = await Promise.all(
      directReports.map((reportId) =>
        this.educationService.getEducationsByMemberId(reportId, tenantId),
      ),
    );
    return results.flat();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getEducation(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<Education> {
    const education = await this.educationService.getEducation(id, tenantId);
    await this.managerAccessService.assertAdminOrSelfOrManagerOf(
      member,
      education.tenantMemberId,
      tenantId,
    );
    return education;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateEducation(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEducationDto: UpdateEducationDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<Education> {
    const education = await this.educationService.getEducation(id, tenantId);
    assertSelfOnly(member, education.tenantMemberId);
    return this.educationService.updateEducation(id, updateEducationDto, tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEducation(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<void> {
    const education = await this.educationService.getEducation(id, tenantId);
    assertSelfOnly(member, education.tenantMemberId);
    return this.educationService.deleteEducation(id, tenantId);
  }
}
