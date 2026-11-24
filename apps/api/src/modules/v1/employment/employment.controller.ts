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
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';

import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { CreateCompensationDto } from './dto/create-compensation.dto';
import { CreateEmploymentDto } from './dto/create-employment.dto';
import { EmploymentMapper, EmploymentResponseDto } from './dto/employment-response.dto';
import { UpdateEmploymentDto } from './dto/update-employment.dto';
import { EmploymentService } from './employment.service';

@ApiTags('Employments')
@Controller('tenants/:tenantId/')
@UseGuards(TenantMemberGuard)
@RequireFeatures(FeatureAccess.BASIC_HR)
export class EmploymentController {
  constructor(
    private readonly employmentService: EmploymentService,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  @Get('compensation/current')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getCurrentCompensation(@Param('tenantId') tenantId: string): Promise<
    Array<{
      memberId: string;
      payRate: number;
      payType: string;
      paySchedule: string;
    }>
  > {
    return this.employmentService.getCurrentSalariesForTenant(tenantId);
  }

  @Post('members/:memberId/compensation')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async addCompensationRecord(
    @Param('tenantId') tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() createCompensationDto: CreateCompensationDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<EmploymentResponseDto> {
    const record = await this.employmentService.addCompensationRecord(
      tenantId,
      memberId,
      member.id,
      createCompensationDto,
    );
    return EmploymentMapper.toResponse(record);
  }

  @Post('members/:memberId/employments')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createEmploymentForMember(
    @Param('tenantId') tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() createEmploymentDto: CreateEmploymentDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<EmploymentResponseDto> {
    const created = await this.employmentService.createEmployment(
      tenantId,
      memberId,
      member.id,
      createEmploymentDto,
    );
    return EmploymentMapper.toResponse(created);
  }

  @Get('members/:memberId/employments')
  @HttpCode(HttpStatus.OK)
  async getEmploymentsByMemberId(
    @Param('tenantId') tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<EmploymentResponseDto[]> {
    await this.managerAccessService.assertAdminOrSelfOrManagerOf(member, memberId, tenantId);
    const employments = await this.employmentService.getEmploymentsByMemberId(tenantId, memberId);
    return EmploymentMapper.toResponseList(employments);
  }
  @Get('employments/:id')
  @HttpCode(HttpStatus.OK)
  async getEmployment(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<EmploymentResponseDto> {
    const employment = await this.employmentService.getEmployment(id, tenantId);
    await this.managerAccessService.assertAdminOrSelfOrManagerOf(
      member,
      employment.tenantMemberId,
      tenantId,
    );
    return EmploymentMapper.toResponse(employment);
  }
  @Patch('employments/:id')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateEmployment(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmploymentDto: UpdateEmploymentDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<EmploymentResponseDto> {
    const updated = await this.employmentService.updateEmployment(
      id,
      updateEmploymentDto,
      tenantId,
      member.id,
    );
    return EmploymentMapper.toResponse(updated);
  }
  @Delete('employments/:id')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEmployment(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<void> {
    return this.employmentService.deleteEmployment(id, tenantId, member.id);
  }
}
