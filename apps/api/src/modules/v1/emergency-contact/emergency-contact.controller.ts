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
import { RelationshipType } from 'src/common/enums';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { EmergencyContactService } from './emergency-contact.service';
import { MemberContext } from 'src/common/interfaces';
import { CreateEmergencyContactDto } from "./dto/create-emergency-contact.dto";
import { EmergencyContact } from "./entities/emergency-contact.entity";
import { UpdateEmergencyContactDto } from "./dto/update-emergency-contact.dto";

@ApiTags('emergency-contacts')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/emergency-contacts')
export class EmergencyContactController {
  constructor(
    private readonly emergencyContactService: EmergencyContactService,
  ) {}
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEmergencyContact(
    @Param('tenantId') tenantId: string,
    @Body() createEmergencyContactDto: CreateEmergencyContactDto,
    @CurrentTenantMember() member: MemberContext
  ): Promise<EmergencyContact> {
    return this.emergencyContactService.createEmergencyContact(
      tenantId,
      member.id,
      createEmergencyContactDto,
    );
  }
  @Get()
  @HttpCode(HttpStatus.OK)
  async getEmergencyContacts(
    @Param('tenantId') tenantId: string,
    @Query('memberId') memberId?: string,
  ): Promise<EmergencyContact[]> {
    return this.emergencyContactService.listEmergencyContacts(
      tenantId,
      memberId,
    );
  }
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getEmergencyContact(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmergencyContact> {
    return this.emergencyContactService.getEmergencyContact(id, tenantId);
  }
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateEmergencyContact(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmergencyContactDto: UpdateEmergencyContactDto,
  ): Promise<EmergencyContact> {
    return this.emergencyContactService.updateEmergencyContact(
      id,
      updateEmergencyContactDto,
      tenantId,
    );
  }
  @Post(':id/set-primary')
  @HttpCode(HttpStatus.OK)
  async setAsPrimary(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmergencyContact> {
    return this.emergencyContactService.setAsPrimary(id, tenantId);
  }
  @Get('relationships/:relationship')
  @HttpCode(HttpStatus.OK)
  async getEmergencyContactsByRelationship(
    @Param('tenantId') tenantId: string,
    @Param('relationship') relationship: RelationshipType,
    @Query('memberId') memberId?: string,
  ): Promise<EmergencyContact[]> {
    return this.emergencyContactService.getEmergencyContactsByRelationship(
      relationship,
      tenantId,
      memberId,
    );
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEmergencyContact(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.emergencyContactService.deleteEmergencyContact(id, tenantId);
  }
}
