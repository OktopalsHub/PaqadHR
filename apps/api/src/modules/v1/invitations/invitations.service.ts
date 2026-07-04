import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PasswordService } from 'src/common/utils';
import { InvitationStatus } from '../../../common/enums';
import type { IInvitationResponseDto } from '../../../common/interfaces/iinvitation-response-dto.interface';
import { RateLimitService } from '../../../common/services/rate-limit.service';
import { ActivitiesService } from '../activities/services/activities.service';
import { ZeptomailEmailService } from '../notifications/services/zeptomail-email.service';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import { TenantsService } from '../tenants/tenants.service';
import type { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { CreateInvitationDto } from './dto/index';
import type { UpdateInvitationDto } from './dto/update-invitation.dto';
import type { Invitation } from './entities/invitation.entity';
import { InvitationsRepository } from './repositories/invitations.repository';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);
  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    private readonly tenantMembersService: TenantMembersService,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly rateLimitService: RateLimitService,
    private readonly zeptomailEmailService: ZeptomailEmailService,
    private readonly activitiesService: ActivitiesService,
  ) {}
  private generateInvitationToken(): string {
    const crypto = require('node:crypto');
    return crypto.randomBytes(32).toString('hex');
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
  async createInvitation(
    createInvitationDto: CreateInvitationDto,
    tenantId: string,
    invitedBy: string,
  ): Promise<IInvitationResponseDto> {
    const existingUser = await this.usersService.getUserByEmail(createInvitationDto.email);
    if (existingUser) {
      const existingMember = await this.tenantMembersService.checkUserTenantMembership(
        existingUser.id,
        tenantId,
      );
      if (existingMember) {
        throw new ConflictException(
          `User with email ${createInvitationDto.email} is already a member of this tenant`,
        );
      }
    }
    const existingInvitations = await this.invitationsRepository.findInvitationByEmail(
      createInvitationDto.email,
    );
    this.logger.log(`Found ${existingInvitations.length} existing invitations for this email`);
    const existingInvitation = existingInvitations.find(
      (inv) => inv.tenantId === tenantId && inv.status === InvitationStatus.PENDING,
    );
    if (existingInvitation) {
      this.logger.warn(
        `Invitation already exists for email: ${createInvitationDto.email} in tenant: ${tenantId}`,
      );
      throw new ConflictException(
        `An invitation has already been sent to ${createInvitationDto.email} for this tenant. Please wait for them to respond or resend the invitation.`,
      );
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const token = this.generateInvitationToken();
    const invitationData: Partial<Invitation> = {
      email: createInvitationDto.email,
      tenantId,
      role: createInvitationDto.role,
      invitedBy,
      expiresAt,
      status: InvitationStatus.PENDING,
      token,
      firstName: createInvitationDto.firstName,
      lastName: createInvitationDto.lastName,
      middleName: createInvitationDto.middleName,
      jobTitle: createInvitationDto.jobTitle,
      departmentId: createInvitationDto.departmentId,
      employmentType: createInvitationDto.employmentType,
      employeeNumber: createInvitationDto.employeeNumber,
      positionId: createInvitationDto.positionId,
    };
    const invitation = await this.invitationsRepository.save(invitationData);
    await this.sendInvitationEmail(invitation);
    return this?.mapToResponseDto(invitation);
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
  private validateName(firstName: string, lastName: string): void {
    if (!firstName || !lastName) {
      throw new BadRequestException('First name and last name are required');
    }
    if (typeof firstName !== 'string' || typeof lastName !== 'string') {
      throw new BadRequestException('First name and last name must be strings');
    }
  }
  async acceptInvitation(
    token: string,
    email: string,
    acceptInvitationDto: {
      password?: string;
      firstName?: string;
      lastName?: string;
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
    this.validateInvitationToken(token);
    this.validateEmailFormat(email);
    await this.checkRateLimitWithContext(`accept_${email}`, 5, 15 * 60 * 1000, 'accept invitation');
    const invitation = await this.invitationsRepository.findInvitationByToken(token);
    if (!invitation) {
      this.logger.warn(`❌ No invitation found for token: ${token}`);
      throw new NotFoundException(`Invitation with token ${token} not found`);
    }
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      this.logger.warn(
        `❌ Email mismatch: invitation email ${invitation.email} does not match requested email ${email}`,
      );
      throw new BadRequestException('The email address does not match the invited user email');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      this.logger.warn(
        `❌ Invitation ${invitation.id} is not pending (status: ${invitation.status})`,
      );
      throw new BadRequestException('Invitation has already been processed');
    }
    if (invitation.expiresAt < new Date()) {
      this.logger.warn(`❌ Invitation ${invitation.id} has expired`);
      throw new BadRequestException('Invitation has expired');
    }

    const firstName =
      acceptInvitationDto?.firstName?.trim() || invitation.firstName?.trim() || '';
    const lastName = acceptInvitationDto?.lastName?.trim() || invitation.lastName?.trim() || '';

    const existingUser = await this.usersService.getUserByEmail(invitation.email);
    let userExists = false;
    let user: User | null = null;
    this.logger.log(`👤 Checking if user exists: ${!!existingUser}`);
    if (existingUser) {
      userExists = true;
      user = existingUser;
      this.logger.log(`✅ Existing user found with ID: ${existingUser.id}`);
      const existingMember = await this.tenantMembersService.checkUserTenantMembership(
        existingUser.id,
        invitation.tenantId,
      );
      if (existingMember) {
        this.logger.warn(`❌ User ${email} is already a member of tenant ${invitation.tenantId}`);
        throw new ConflictException('User is already a member of this tenant');
      }
      if (acceptInvitationDto.password) {
        const hashedPassword = await PasswordService.hashPassword(acceptInvitationDto.password);
        await this.usersService.updateUser(user.id, {
          password: hashedPassword,
        });
        this.logger.log(`🔑 Updated password for existing user`);
      }
      await this.tenantMembersService.createTenantMember(existingUser.id, invitation.tenantId, {
        firstName: firstName || invitation.firstName,
        lastName: lastName || invitation.lastName,
        role: invitation.role as never,
      });
      this.logger.log(`✅ Existing user added to tenant successfully`);
    } else {
      this.logger.log(`🆕 Creating new user account`);
      if (!acceptInvitationDto.password) {
        this.logger.warn(`❌ Password required for new user`);
        throw new BadRequestException('Password required for new users');
      }
      this.validateName(firstName, lastName);
      const password = await PasswordService.hashPassword(acceptInvitationDto.password);
      const newUser = await this.usersService.createUser({
        email: invitation.email,
        password,
        name: `${firstName} ${lastName}`,
        role: invitation.role,
        isActive: true,
      });
      user = newUser;
      this.logger.log(`✅ New user created with ID: ${newUser.id}`);
      await this.tenantMembersService.createTenantMember(newUser.id, invitation.tenantId, {
        firstName,
        lastName,
        role: invitation.role as never,
      });
      this.logger.log(`✅ New user added to tenant successfully`);
    }
    const updatedInvitation = await this.invitationsRepository.acceptInvitation(invitation.id);
    await this.invitationsRepository.softDelete(invitation.id);
    await this.rateLimitService.clearRateLimit(`accept_${email}`);

    const tenant = await this.tenantsService.getTenant(invitation.tenantId);
    void this.activitiesService
      .queueActivity({
        tenantId: invitation.tenantId,
        actorMemberId: invitation.invitedBy,
        action: 'invite.accepted',
        resourceType: 'invitation',
        resourceId: invitation.id,
        description: `${invitation.email} joined ${tenant?.name ?? 'the workspace'}`,
        metadata: { email: invitation.email, role: invitation.role },
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to queue invite accepted activity: ${err instanceof Error ? err.message : err}`,
        );
      });

    this.logger.log(`🎉 INVITATION ACCEPTED SUCCESSFULLY:`);
    this.logger.log(`📧 Email: ${email}`);
    this.logger.log(`👤 User exists: ${userExists}`);
    this.logger.log(`🔐 Needs password: ${!userExists}`);
    this.logger.log(`🏢 Tenant ID: ${invitation.tenantId}`);
    this.logger.log(`👨‍💼 Role: ${invitation.role}`);
    return {
      invitation: await this?.mapToResponseDto(updatedInvitation),
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
    return this?.mapToResponseDto(invitation);
  }
  async resendInvitation(id: string, tenantId: string): Promise<IInvitationResponseDto> {
    this.logger.log(`🔄 Resending invitation with ID: ${id}`);
    const invitation = await this.invitationsRepository.findInvitationByTenant(id, tenantId);
    if (!invitation) {
      this.logger.warn(`❌ Invitation with ID ${id} not found`);
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      this.logger.warn(`❌ Cannot resend invitation with status: ${invitation.status}`);
      throw new BadRequestException('Can only resend pending invitations');
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    this.logger.log(`📅 Updating expiration date to: ${expiresAt}`);
    await this.invitationsRepository.update(id, {
      expiresAt,
    });
    const updatedInvitation = await this.invitationsRepository.findOne({
      where: { id, tenantId },
    });
    if (!updatedInvitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }
    await this.sendInvitationEmail(updatedInvitation);
    this.logger.log('✅ INVITATION RESENT SUCCESSFULLY:');
    this.logger.log(`📧 Email: ${updatedInvitation.email}`);
    this.logger.log(`🏢 Tenant ID: ${updatedInvitation.tenantId}`);
    this.logger.log(`👤 Role: ${updatedInvitation.role}`);
    this.logger.log(`⏰ New expiration: ${updatedInvitation.expiresAt}`);
    this.logger.log(`🔗 Token: ${updatedInvitation.token}`);
    return this?.mapToResponseDto(updatedInvitation);
  }
  async expireInvitations(): Promise<void> {
    await this.invitationsRepository.expireInvitations();
  }
  private validateInvitationToken(token: string): void {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    if (typeof token !== 'string') {
      throw new BadRequestException('Token must be a string');
    }
  }
  private validateEmailFormat(email: string): void {
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format');
    }
  }
  private async checkRateLimitWithContext(
    key: string,
    max: number,
    windowMs: number,
    context: string,
  ): Promise<void> {
    const result = await this.rateLimitService.checkRateLimit(key, {
      rules: [{ maxRequests: max, windowMs }],
    });
    if (!result.allowed) {
      this.logger.warn(`Rate limit exceeded for ${context}`, { key });
      throw new InternalServerErrorException('Too many attempts. Please try again later.');
    }
  }
  private validateInvitation(invitation: Invitation, email: string): void {
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      this.logger.warn('Email does not match invitation', {
        providedEmail: email,
        invitationEmail: invitation.email,
        invitationId: invitation.id,
      });
      throw new BadRequestException('The email address does not match the invited user email');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      this.logger.warn('Invitation is not pending', {
        status: invitation.status,
        invitationId: invitation.id,
      });
      throw new BadRequestException('This invitation has already been processed');
    }
  }
  async getInvitationByTokenAndEmail(
    token: string,
    email: string,
  ): Promise<IInvitationResponseDto & { userExists: boolean; user: unknown }> {
    this.validateInvitationToken(token);
    this.validateEmailFormat(email);
    this.logger.log('Getting invitation details', {
      email,
      token: `${token.substring(0, 8)}...`,
    });
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
    this.validateInvitation(invitation, email);
    if (invitation.expiresAt < new Date()) {
      this.logger.warn('Invitation has expired', {
        invitationId: invitation.id,
        expiredAt: invitation.expiresAt,
      });
      throw new BadRequestException('Invitation has expired');
    }
    const existingUser = await this.usersService.getUserByEmail(email);
    const userExists = !!existingUser;
    this.logger.log(`User exists: ${userExists}`);
    if (userExists) {
      this.logger.log(`Existing user ID: ${existingUser.id}`);
    }
    await this.rateLimitService.clearRateLimit(`get_invitation_${email}`);
    this.logger.log('Invitation details retrieved successfully', {
      invitationId: invitation.id,
      email,
    });
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
  async declineInvitationByTokenAndEmail(
    token: string,
    email: string,
  ): Promise<IInvitationResponseDto> {
    this.validateInvitationToken(token);
    this.validateEmailFormat(email);
    this.logger.log('Processing invitation decline', {
      email,
      token: `${token.substring(0, 8)}...`,
    });
    await this.checkRateLimitWithContext(
      `decline_${email}`,
      5,
      15 * 60 * 1000,
      'decline invitation',
    );
    const invitation = await this.invitationsRepository.findInvitationByToken(token);
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    this.validateInvitation(invitation, email);
    if (invitation.expiresAt < new Date()) {
      this.logger.warn('Cannot decline expired invitation', {
        invitationId: invitation.id,
        expiredAt: invitation.expiresAt,
      });
      throw new BadRequestException('Invitation has expired');
    }
    await this.invitationsRepository.update(invitation.id, {
      status: InvitationStatus.DECLINED,
    });
    const updatedInvitation = await this.invitationsRepository.findOne({
      where: { id: invitation.id },
    });
    if (!updatedInvitation) {
      this.logger.error('Failed to update invitation status', {
        invitationId: invitation.id,
        email,
      });
      throw new InternalServerErrorException('Failed to process invitation decline');
    }
    await this.rateLimitService.clearRateLimit(`decline_${email}`);
    this.logger.log('Invitation declined successfully', {
      invitationId: invitation.id,
      email,
    });
    return this.mapToResponseDto(updatedInvitation);
  }
  private async sendInvitationEmail(invitation: Invitation): Promise<void> {
    const tenant = await this.tenantsService.getTenant(invitation.tenantId);
    const baseUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const inviteLink = `${baseUrl}/accept-invite?token=${invitation.token}&email=${encodeURIComponent(invitation.email)}`;

    let inviterName = 'A team member';
    try {
      const inviter = await this.tenantMembersService.getTenantMember(
        invitation.invitedBy,
        invitation.tenantId,
      );
      const name = [inviter.firstName, inviter.lastName].filter(Boolean).join(' ').trim();
      inviterName = name || inviter.user?.email || inviterName;
    } catch {
      this.logger.warn(`Could not resolve inviter for invitation ${invitation.id}`);
    }

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
      this.logger.error(`Failed to send invitation email to ${invitation.email}: ${result.error}`);
      return;
    }

    void this.activitiesService
      .queueActivity({
        tenantId: invitation.tenantId,
        actorMemberId: invitation.invitedBy,
        action: 'invite.sent',
        resourceType: 'invitation',
        resourceId: invitation.id,
        description: `Invitation sent to ${invitation.email}`,
        metadata: { email: invitation.email, role: invitation.role },
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to queue invite sent activity: ${err instanceof Error ? err.message : err}`,
        );
      });

    this.logger.log(`Invitation email sent to ${invitation.email}`);
  }
  private async mapToResponseDto(invitation: Invitation): Promise<IInvitationResponseDto> {
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
    };
  }
}
