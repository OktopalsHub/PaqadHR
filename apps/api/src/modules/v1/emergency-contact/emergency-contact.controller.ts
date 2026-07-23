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
import { CurrentTenantMember } from 'src/common/decorators';
import type { RelationshipType } from 'src/common/enums';
import type { MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { assertSelfOnly, isTenantAdmin } from 'src/common/utils/member-access.util';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { CreateEmergencyContactDto } from './dto/create-emergency-contact.dto';
import { UpdateEmergencyContactDto } from './dto/update-emergency-contact.dto';
import { EmergencyContactService } from './emergency-contact.service';
import type { EmergencyContact } from './entities/emergency-contact.entity';

@ApiTags('Emergency Contacts')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/emergency-contacts')
export class EmergencyContactController {
  constructor(
    private readonly emergencyContactService: EmergencyContactService,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEmergencyContact(
    @Param('tenantId') tenantId: string,
    @Body() createEmergencyContactDto: CreateEmergencyContactDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<EmergencyContact> {
    const { memberId, ...contactData } = createEmergencyContactDto;
    const targetMemberId = memberId ?? member.id;
    assertSelfOnly(member, targetMemberId);
    return this.emergencyContactService.createEmergencyContact(
      tenantId,
      targetMemberId,
      contactData,
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getEmergencyContacts(
    @Param('tenantId') tenantId: string,
    @Query('memberId') memberId: string | undefined,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<EmergencyContact[]> {
    if (memberId) {
      await this.managerAccessService.assertAdminOrSelfOrManagerOf(member, memberId, tenantId);
      return this.emergencyContactService.listEmergencyContacts(tenantId, memberId);
    }
    if (isTenantAdmin(member)) {
      return this.emergencyContactService.listEmergencyContacts(tenantId);
    }
    const directReports = await this.managerAccessService.getDirectReportIds(tenantId, member.id);
    if (directReports.length === 0) {
      throw new ForbiddenException('Admin or manager access required');
    }
    const results = await Promise.all(
      directReports.map((reportId) =>
        this.emergencyContactService.listEmergencyContacts(tenantId, reportId),
      ),
    );
    return results.flat();
  }

  @Get('relationships/:relationship')
  @HttpCode(HttpStatus.OK)
  async getEmergencyContactsByRelationship(
    @Param('tenantId') tenantId: string,
    @Param('relationship') relationship: RelationshipType,
    @Query('memberId') memberId: string | undefined,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<EmergencyContact[]> {
    if (memberId) {
      await this.managerAccessService.assertAdminOrSelfOrManagerOf(member, memberId, tenantId);
    } else if (!isTenantAdmin(member)) {
      throw new ForbiddenException('Admin or manager access required');
    }
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
    @CurrentTenantMember() member: MemberContext,
  ): Promise<EmergencyContact> {
    const contact = await this.emergencyContactService.getEmergencyContact(id, tenantId);
    await this.managerAccessService.assertAdminOrSelfOrManagerOf(
      member,
      contact.tenantMemberId,
      tenantId,
    );
    return contact;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateEmergencyContact(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmergencyContactDto: UpdateEmergencyContactDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<EmergencyContact> {
    const contact = await this.emergencyContactService.getEmergencyContact(id, tenantId);
    assertSelfOnly(member, contact.tenantMemberId);
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
    @CurrentTenantMember() member: MemberContext,
  ): Promise<EmergencyContact> {
    const contact = await this.emergencyContactService.getEmergencyContact(id, tenantId);
    assertSelfOnly(member, contact.tenantMemberId);
    return this.emergencyContactService.setAsPrimary(id, tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEmergencyContact(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<void> {
    const contact = await this.emergencyContactService.getEmergencyContact(id, tenantId);
    assertSelfOnly(member, contact.tenantMemberId);
    return this.emergencyContactService.deleteEmergencyContact(id, tenantId);
  }
}
