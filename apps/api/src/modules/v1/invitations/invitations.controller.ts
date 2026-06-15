import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards } from '@nestjs/common';
import { CurrentTenantMember } from 'src/common/decorators';
import { ApiTags } from '@nestjs/swagger';
import { MemberContext } from '../../../common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from "./dto/index";
import { UpdateInvitationDto } from "./dto/update-invitation.dto";

@ApiTags('Invitations')
@Controller('tenants/:tenantId/invites')
@UseGuards(TenantMemberGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}
  @Get()
  async getTenantInvitations(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Query('status') status?: string,
  ) {
    if (status) {
      return this.invitationsService.getInvitationsByTenantId(tenantId, status);
    }
    return this.invitationsService.getInvitationsByTenantId(tenantId);
  }
  @Get(':id')
  async getInvitation(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.invitationsService.getInvitation(id, tenantId);
  }
  @Post('')
    async createInvitation(
    @Param('tenantId') tenantId: string,
    @Body() createInvitationDto: CreateInvitationDto,
    @CurrentTenantMember() member: MemberContext
    ) {
    return this.invitationsService.createInvitation(
      createInvitationDto,
      tenantId,
      member.id,
    );
  }
  @Put(':id')
    async updateInvitation(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateInvitationDto: UpdateInvitationDto,
  ) {
    return this.invitationsService.updateInvitation(
      id,
      updateInvitationDto,
      tenantId,
    );
  }
  @Delete(':id')
    async deleteInvitation(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.invitationsService.deleteInvitation(id, tenantId);
  }
  @Post(':id/resend')
    async resendInvitation(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.invitationsService.resendInvitation(id, tenantId);
  }
}
