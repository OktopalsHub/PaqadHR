import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PasswordService } from 'src/common/utils';
import { InvitationStatus } from '../../../../common/enums';
import type { IInvitationResponseDto } from '../../../../common/interfaces/iinvitation-response-dto.interface';
import { ProductAnalyticsService } from '../../../../common/observability/product-analytics.service';
import { RateLimitService } from '../../../../common/services/rate-limit.service';
import { formatMemberDisplayName } from '../../../../common/utils/member-display.util';
import { ActivitiesService } from '../../activities/services/activities.service';
import { DepartmentsService } from '../../departments/departments.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { PositionMemberService } from '../../position/services/position-member.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { TenantsService } from '../../tenants/tenants.service';
import type { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import type { Invitation } from '../entities/invitation.entity';
import { InvitationsRepository } from '../repositories/invitations.repository';
import {
  validateEmailFormat,
  validateInvitation,
  validateInvitationToken,
  validateName,
} from '../utils/invitation-validation.util';
import { InvitationManagementService } from './invitation-management.service';

@Injectable()
export class InvitationAcceptanceService {
  private readonly logger = new Logger(InvitationAcceptanceService.name);

  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    private readonly usersService: UsersService,
    private readonly tenantMembersService: TenantMembersService,
    private readonly tenantsService: TenantsService,
    private readonly departmentsService: DepartmentsService,
    private readonly positionMemberService: PositionMemberService,
    private readonly notificationHelperService: NotificationHelperService,
    private readonly activitiesService: ActivitiesService,
    private readonly productAnalytics: ProductAnalyticsService,
    private readonly rateLimitService: RateLimitService,
    private readonly managementService: InvitationManagementService,
  ) {}

  private async provisionAcceptanceUser(
    invitation: Invitation,
    acceptInvitationDto: {
      password?: string;
      firstName?: string;
      lastName?: string;
      preferredName?: string;
    },
    firstName: string,
    lastName: string,
    preferredName: string | undefined,
  ): Promise<{ user: User | null; userExists: boolean; tenantMemberId: string }> {
    const existingUser = await this.usersService.getUserByEmail(invitation.email);
    if (existingUser) {
      const existingMember = await this.tenantMembersService.findUserTenantMembership(
        existingUser.id,
        invitation.tenantId,
      );
      if (existingMember) {
        throw new ConflictException('User is already a member of this tenant');
      }
      if (acceptInvitationDto.password) {
        const hashedPassword = await PasswordService.hashPassword(acceptInvitationDto.password);
        await this.usersService.updateUser(existingUser.id, {
          password: hashedPassword,
        });
      }
      const member = await this.tenantMembersService.createTenantMember(
        existingUser.id,
        invitation.tenantId,
        {
          firstName,
          lastName,
          preferredName,
          role: invitation.role as never,
        },
      );
      return { user: existingUser, userExists: true, tenantMemberId: member.id };
    }

    if (!acceptInvitationDto.password) {
      throw new BadRequestException('Password required for new users');
    }
    const password = await PasswordService.hashPassword(acceptInvitationDto.password);
    const newUser = await this.usersService.createUser({
      email: invitation.email,
      password,
      name: `${firstName} ${lastName}`,
      role: invitation.role,
      isActive: true,
    });
    const member = await this.tenantMembersService.createTenantMember(
      newUser.id,
      invitation.tenantId,
      {
        firstName,
        lastName,
        preferredName,
        role: invitation.role as never,
      },
    );
    return { user: newUser, userExists: false, tenantMemberId: member.id };
  }

  private async emitAcceptanceSideEffects(
    invitation: Invitation,
    tenantMemberId: string,
    inviteeName: string,
    user: User | null,
  ): Promise<void> {
    void this.activitiesService
      .queueActivity({
        tenantId: invitation.tenantId,
        actorMemberId: tenantMemberId,
        action: 'invite.accepted',
        resourceType: 'invitation',
        resourceId: invitation.id,
        description: inviteeName === 'A team member' ? 'Member joined' : `${inviteeName} joined`,
        metadata: { role: invitation.role, inviteeName },
      })
      .catch(() => {});

    void this.notificationHelperService
      .sendWelcomeNotification(tenantMemberId, invitation.tenantId, {
        name: inviteeName,
        tenantName:
          (await this.tenantsService.getTenant(invitation.tenantId))?.name ?? 'the workspace',
      })
      .catch((error) => {
        this.logger.error('Failed to send welcome notification', error);
      });

    void this.notificationHelperService
      .sendNewTeamMemberNotification(invitation.tenantId, {
        newMemberName: inviteeName,
        role: invitation.role,
      })
      .catch((error) => {
        this.logger.error('Failed to send new team member notification', error);
      });

    if (user) {
      this.productAnalytics.capture(user.id, 'invite_accepted', {
        userId: user.id,
        tenantId: invitation.tenantId,
        role: invitation.role,
      });
      this.productAnalytics.capture(user.id, 'workspace_activated', {
        userId: user.id,
        tenantId: invitation.tenantId,
        role: invitation.role,
      });
    }
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
    validateInvitationToken(token);
    validateEmailFormat(email);
    await this.managementService.checkRateLimitWithContext(
      `accept_${email}`,
      5,
      15 * 60 * 1000,
      'accept invitation',
    );
    const invitation = await this.invitationsRepository.findInvitationByToken(token);
    if (!invitation) {
      throw new NotFoundException(`Invitation with token ${token} not found`);
    }
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      throw new BadRequestException('The email address does not match the invited user email');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation has already been processed');
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    const firstName = acceptInvitationDto.firstName?.trim() ?? '';
    const lastName = acceptInvitationDto.lastName?.trim() ?? '';
    validateName(firstName, lastName);

    const preferredName = acceptInvitationDto?.preferredName?.trim() || undefined;
    const { user, userExists, tenantMemberId } = await this.provisionAcceptanceUser(
      invitation,
      acceptInvitationDto,
      firstName,
      lastName,
      preferredName,
    );

    if (invitation.departmentId) {
      await this.departmentsService.addMemberToDepartment(
        invitation.tenantId,
        invitation.departmentId,
        tenantMemberId,
        tenantMemberId,
      );
    }
    if (invitation.positionId) {
      await this.positionMemberService.assignPosition(
        invitation.tenantId,
        tenantMemberId,
        invitation.positionId,
      );
    }
    const updatedInvitation = await this.invitationsRepository.acceptInvitation(invitation.id);
    await this.invitationsRepository.softDelete(invitation.id);
    await this.rateLimitService.clearRateLimit(`accept_${email}`);

    const inviteeName =
      formatMemberDisplayName({ firstName, lastName, preferredName }) ?? 'A team member';
    await this.emitAcceptanceSideEffects(invitation, tenantMemberId, inviteeName, user);

    return {
      invitation: await this.managementService.mapToResponseDto(updatedInvitation),
      userExists,
      user: user
        ? {
            id: user.id,
            email: user.email,
            role: user.role,
            needsPassword: !userExists,
          }
        : null,
    };
  }

  async declineInvitation(id: string, tenantId: string): Promise<IInvitationResponseDto> {
    const invitation = await this.invitationsRepository.findInvitationByTenant(id, tenantId);
    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is not pending');
    }
    await this.invitationsRepository.delete(id);

    void this.notificationHelperService
      .sendInvitationDeclinedNotification(invitation.invitedBy, tenantId, {
        inviteeEmail: invitation.email,
      })
      .catch((error) => {
        this.logger.error('Failed to send invitation declined notification', error);
      });

    return this.managementService.mapToResponseDto(invitation);
  }

  async declineInvitationByTokenAndEmail(
    token: string,
    email: string,
  ): Promise<IInvitationResponseDto> {
    validateInvitationToken(token);
    validateEmailFormat(email);
    await this.managementService.checkRateLimitWithContext(
      `decline_${email}`,
      5,
      15 * 60 * 1000,
      'decline invitation',
    );
    const invitation = await this.invitationsRepository.findInvitationByToken(token);
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    validateInvitation(invitation, email);
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }
    await this.invitationsRepository.update(invitation.id, {
      status: InvitationStatus.DECLINED,
    });
    const updatedInvitation = await this.invitationsRepository.findOne({
      where: { id: invitation.id },
    });
    if (!updatedInvitation) {
      throw new InternalServerErrorException('Failed to process invitation decline');
    }
    await this.rateLimitService.clearRateLimit(`decline_${email}`);
    return this.managementService.mapToResponseDto(updatedInvitation);
  }
}
