import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus } from '../../../../common/enums';
import type { IInvitationResponseDto } from '../../../../common/interfaces/iinvitation-response-dto.interface';
import { ProductAnalyticsService } from '../../../../common/observability/product-analytics.service';
import { RateLimitService } from '../../../../common/services/rate-limit.service';
import { formatInviteeDisplayName } from '../../../../common/utils/member-display.util';
import { ActivitiesService } from '../../activities/services/activities.service';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { TenantsService } from '../../tenants/tenants.service';
import { UsersService } from '../../users/users.service';
import type { UpdateInvitationDto } from '../dto/update-invitation.dto';
import type { Invitation } from '../entities/invitation.entity';
import { InvitationsRepository } from '../repositories/invitations.repository';
import {
  validateEmailFormat,
  validateInvitation,
  validateInvitationToken,
} from '../utils/invitation-validation.util';

@Injectable()
export class InvitationManagementService {
  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
    private readonly rateLimitService: RateLimitService,
    private readonly tenantMembersService: TenantMembersService,
    private readonly zeptomailEmailService: ZeptomailEmailService,
    private readonly activitiesService: ActivitiesService,
    private readonly productAnalytics: ProductAnalyticsService,
  ) {}

  generateInvitationToken(): string {
    const crypto = require('node:crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  async checkRateLimitWithContext(
    key: string,
    max: number,
    windowMs: number,
    context: string,
  ): Promise<void> {
    const result = await this.rateLimitService.checkRateLimit(key, {
      rules: [{ maxRequests: max, windowMs }],
    });
    if (!result.allowed) {
      throw new InternalServerErrorException('Too many attempts. Please try again later.');
    }
  }

  async mapToResponseDto(
    invitation: Invitation,
    emailDelivery?: { emailSent: boolean; emailError?: string },
  ): Promise<IInvitationResponseDto> {
    const tenant = await this.tenantsService.getTenant(invitation.tenantId);
    return {
      id: invitation.id,
      email: invitation.email,
      tenantId: invitation.tenantId,
      tenantName: tenant?.name,
      tenantSlug: tenant?.slug,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      middleName: invitation.middleName,
      jobTitle: invitation.jobTitle,
      departmentId: invitation.departmentId,
      employmentType: invitation.employmentType,
      employeeNumber: invitation.employeeNumber,
      role: invitation.role,
      status: invitation.status,
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt,
      token: invitation.token,
      ...(emailDelivery
        ? { emailSent: emailDelivery.emailSent, emailError: emailDelivery.emailError }
        : {}),
    };
  }

  async listInvitations(status?: string): Promise<IInvitationResponseDto[]> {
    const invitations = await this.invitationsRepository.listInvitations(status);
    return Promise.all(invitations?.map((invitation) => this?.mapToResponseDto(invitation)));
  }

  async getInvitation(id: string, tenantId: string): Promise<IInvitationResponseDto> {
    const invitation = await this.invitationsRepository.findInvitationByTenant(id, tenantId);
    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }
    return this?.mapToResponseDto(invitation);
  }

  async getInvitationsByTenantId(
    tenantId: string,
    status?: string,
  ): Promise<IInvitationResponseDto[]> {
    const invitations = await this.invitationsRepository.listInvitationsByTenant(tenantId, status);
    return Promise.all(invitations?.map((invitation) => this?.mapToResponseDto(invitation)));
  }

  async updateInvitation(
    id: string,
    updateInvitationDto: UpdateInvitationDto,
    tenantId: string,
  ): Promise<IInvitationResponseDto> {
    const invitation = await this.invitationsRepository.findInvitationByTenant(id, tenantId);
    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Cannot update a non-pending invitation');
    }
    const updateData: Partial<Invitation> = { ...updateInvitationDto };
    const updatedInvitation = await this.invitationsRepository.updateInvitation(id, updateData);
    return this?.mapToResponseDto(updatedInvitation);
  }

  async deleteInvitation(id: string, tenantId: string): Promise<void> {
    const invitation = await this.invitationsRepository.findInvitationByTenant(id, tenantId);
    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }
    await this.invitationsRepository.delete(id);
  }

  async resendInvitation(id: string, tenantId: string): Promise<IInvitationResponseDto> {
    const invitation = await this.invitationsRepository.findInvitationByTenant(id, tenantId);
    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Can only resend pending invitations');
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.invitationsRepository.update(id, {
      expiresAt,
    });
    const updatedInvitation = await this.invitationsRepository.findOne({
      where: { id, tenantId },
    });
    if (!updatedInvitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }
    const emailDelivery = await this.sendInvitationEmail(updatedInvitation);
    return this.mapToResponseDto(updatedInvitation, emailDelivery);
  }

  async expireInvitations(): Promise<void> {
    await this.invitationsRepository.expireInvitations();
  }

  async getInvitationByTokenAndEmail(
    token: string,
    email: string,
  ): Promise<IInvitationResponseDto & { userExists: boolean; user: unknown }> {
    validateInvitationToken(token);
    validateEmailFormat(email);
    await this.checkRateLimitWithContext(
      `get_invitation_${email}`,
      10,
      15 * 60 * 1000,
      'get invitation details',
    );
    const invitation = await this.invitationsRepository.findInvitationByToken(token);
    if (!invitation) {
      throw new NotFoundException('Inviation not found');
    }
    validateInvitation(invitation, email);
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }
    const existingUser = await this.usersService.getUserByEmail(email);
    const userExists = !!existingUser;
    await this.rateLimitService.clearRateLimit(`get_invitation_${email}`);
    const response = await this.mapToResponseDto(invitation);
    return {
      ...response,
      userExists,
      user: existingUser
        ? {
            id: existingUser.id,
            email: existingUser.email,
            role: existingUser.role,
            needsPassword: false,
          }
        : null,
    };
  }

  async sendInvitationEmail(
    invitation: Invitation,
  ): Promise<{ emailSent: boolean; emailError?: string }> {
    const tenant = await this.tenantsService.getTenant(invitation.tenantId);
    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const inviteLink = `${baseUrl}/accept-invite?token=${invitation.token}&email=${encodeURIComponent(invitation.email)}`;

    let inviterName = 'A team member';
    try {
      const inviter = await this.tenantMembersService.getTenantMember(
        invitation.invitedBy,
        invitation.tenantId,
      );
      const name = [inviter.firstName, inviter.lastName].filter(Boolean).join(' ').trim();
      inviterName = name || inviter.user?.email || inviterName;
    } catch {}

    const firstName = invitation.firstName?.trim() || invitation.email.split('@')[0] || 'there';

    const result = await this.zeptomailEmailService.sendTemplateEmail(
      invitation.email,
      'invitation',
      {
        tenantName: tenant?.name ?? 'your workspace',
        inviterName,
        inviteLink,
        firstName,
      },
    );

    if (!result.success) {
      const emailError = result.error ?? 'unknown error';
      return { emailSent: false, emailError };
    }

    const inviteeName = formatInviteeDisplayName(invitation);
    void this.activitiesService
      .queueActivity({
        tenantId: invitation.tenantId,
        actorMemberId: invitation.invitedBy,
        action: 'invite.sent',
        resourceType: 'invitation',
        resourceId: invitation.id,
        description: inviteeName === 'A team member' ? 'Invitation sent' : `Invited ${inviteeName}`,
        metadata: { role: invitation.role, inviteeName },
      })
      .catch(() => {});

    this.productAnalytics.capture(invitation.invitedBy, 'invite_sent', {
      userId: invitation.invitedBy,
      tenantId: invitation.tenantId,
      role: invitation.role,
    });

    return { emailSent: true };
  }
}
