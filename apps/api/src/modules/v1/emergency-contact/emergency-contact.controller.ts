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
import type { RelationshipType } from 'src/common/enums';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import type { CreateEmergencyContactDto } from './dto/create-emergency-contact.dto';
import type { UpdateEmergencyContactDto } from './dto/update-emergency-contact.dto';
import { EmergencyContactService } from './emergency-contact.service';
import type { EmergencyContact } from './entities/emergency-contact.entity';

@ApiTags('emergency-contacts')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/emergency-contacts')
export class EmergencyContactController {
  constructor(private readonly emergencyContactService: EmergencyContactService) {}
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEmergencyContact(
    @Param('tenantId') tenantId: string,
    @Body() createEmergencyContactDto: CreateEmergencyContactDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<EmergencyContact> {
    const { memberId, ...contactData } = createEmergencyContactDto;
    return this.emergencyContactService.createEmergencyContact(
      tenantId,
      memberId ?? member.id,
      contactData,
    );
  }
  @Get()
  @HttpCode(HttpStatus.OK)
  async getEmergencyContacts(
    @Param('tenantId') tenantId: string,
    @Query('memberId') memberId?: string,
  ): Promise<EmergencyContact[]> {
    return this.emergencyContactService.listEmergencyContacts(tenantId, memberId);
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
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEmergencyContact(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.emergencyContactService.deleteEmergencyContact(id, tenantId);
  }
}
