import { Injectable } from '@nestjs/common';
import { TenantMemberRole } from '../../../common/enums';
import type { IInvitationResponseDto } from '../../../common/interfaces/iinvitation-response-dto.interface';
import type { CreateInvitationDto } from './dto/index';
import type { UpdateInvitationDto } from './dto/update-invitation.dto';
import { InvitationAcceptanceService } from './services/invitation-acceptance.service';
import { InvitationManagementService } from './services/invitation-management.service';
import { InvitationSendingService } from './services/invitation-sending.service';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly managementService: InvitationManagementService,
    private readonly sendingService: InvitationSendingService,
    private readonly acceptanceService: InvitationAcceptanceService,
  ) {}

  async listInvitations(status?: string): Promise<IInvitationResponseDto[]> {
    return this.managementService.listInvitations(status);
  }

  async getInvitation(id: string, tenantId: string): Promise<IInvitationResponseDto> {
    return this.managementService.getInvitation(id, tenantId);
  }

  async getInvitationsByTenantId(
    tenantId: string,
    status?: string,
  ): Promise<IInvitationResponseDto[]> {
    return this.managementService.getInvitationsByTenantId(tenantId, status);
  }

  async createInvitation(
    createInvitationDto: CreateInvitationDto,
    tenantId: string,
    invitedBy: string,
    options?: { sendEmail?: boolean },
  ): Promise<IInvitationResponseDto> {
    return this.sendingService.createInvitation(createInvitationDto, tenantId, invitedBy, options);
  }

  async inviteMember(
    tenantId: string,
    inviteData: {
      email: string;
      firstName: string;
      lastName: string;
      role?: TenantMemberRole;
      sendWelcomeEmail?: boolean;
    },
    invitedBy: string,
  ): Promise<IInvitationResponseDto> {
    return this.sendingService.inviteMember(tenantId, inviteData, invitedBy);
  }

  async updateInvitation(
    id: string,
    updateInvitationDto: UpdateInvitationDto,
    tenantId: string,
  ): Promise<IInvitationResponseDto> {
    return this.managementService.updateInvitation(id, updateInvitationDto, tenantId);
  }

  async deleteInvitation(id: string, tenantId: string): Promise<void> {
    return this.managementService.deleteInvitation(id, tenantId);
  }

  async acceptInvitation(
    token: string,
    email: string,
    acceptInvitationDto: {
      password?: string;
      firstName?: string;
      lastName?: string;
      preferredName?: string;
    } = {},
  ): Promise<{
    invitation: IInvitationResponseDto;
    userExists: boolean;
    user?: {
      id: string;
      email: string;
      role: string;
      needsPassword: boolean;
    } | null;
  }> {
    return this.acceptanceService.acceptInvitation(token, email, acceptInvitationDto);
  }

  async declineInvitation(id: string, tenantId: string): Promise<IInvitationResponseDto> {
    return this.acceptanceService.declineInvitation(id, tenantId);
  }

  async resendInvitation(id: string, tenantId: string): Promise<IInvitationResponseDto> {
    return this.managementService.resendInvitation(id, tenantId);
  }

  async expireInvitations(): Promise<void> {
    return this.managementService.expireInvitations();
  }

  async getInvitationByTokenAndEmail(
    token: string,
    email: string,
  ): Promise<IInvitationResponseDto & { userExists: boolean; user: unknown }> {
    return this.managementService.getInvitationByTokenAndEmail(token, email);
  }

  async declineInvitationByTokenAndEmail(
    token: string,
    email: string,
  ): Promise<IInvitationResponseDto> {
    return this.acceptanceService.declineInvitationByTokenAndEmail(token, email);
  }
}
