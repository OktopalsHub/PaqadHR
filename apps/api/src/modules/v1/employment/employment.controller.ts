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
  UseGuards } from '@nestjs/common';
import { CurrentTenantMember } from 'src/common/decorators';
import { ApiTags } from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { EmploymentService } from './employment.service';
import { MemberContext } from 'src/common/interfaces';
import { CreateEmploymentDto } from "./dto/create-employment.dto";
import { Employment } from "./entities/employment.entity";
import { UpdateEmploymentDto } from "./dto/update-employment.dto";

@ApiTags('Employments')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/')
export class EmploymentController {
  constructor(private readonly employmentService: EmploymentService) {}
  @Post('employments')
  @HttpCode(HttpStatus.CREATED)
  async createEmployment(
    @Param('tenantId') tenantId: string,
    @Body() createEmploymentDto: CreateEmploymentDto,
    @CurrentTenantMember() member: MemberContext
  ): Promise<Employment> {
    return this.employmentService.createEmployment(
      tenantId,
      member.id,
      member.id,
      createEmploymentDto,
    );
  }
  @Get('members/:memberId/employments')
  @HttpCode(HttpStatus.OK)
  async getEmploymentsByMemberId(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
  ): Promise<Employment[]> {
    return this.employmentService.getEmploymentsByMemberId(tenantId, memberId);
  }
  @Get('employments/:id')
  @HttpCode(HttpStatus.OK)
  async getEmployment(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Employment> {
    return this.employmentService.getEmployment(id, tenantId);
  }
  @Patch('employments/:id')
  @HttpCode(HttpStatus.OK)
  async updateEmployment(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmploymentDto: UpdateEmploymentDto,
  ): Promise<Employment> {
    return this.employmentService.updateEmployment(
      id,
      updateEmploymentDto,
      tenantId,
    );
  }
  @Delete('employments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEmployment(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.employmentService.deleteEmployment(id, tenantId);
  }
}
