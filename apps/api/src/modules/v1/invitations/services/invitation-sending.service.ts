import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { StringUtility } from 'src/common/utils';
import { QueryFailedError } from 'typeorm';
import { InvitationStatus, TenantMemberRole } from '../../../../common/enums';
import type { IInvitationResponseDto } from '../../../../common/interfaces/iinvitation-response-dto.interface';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { UsersService } from '../../users/users.service';
import type { CreateInvitationDto } from '../dto/index';
import type { Invitation } from '../entities/invitation.entity';
import { InvitationsRepository } from '../repositories/invitations.repository';
import { InvitationManagementService } from './invitation-management.service';

@Injectable()
export class InvitationSendingService {
  private readonly logger = new Logger(InvitationSendingService.name);

  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    private readonly usersService: UsersService,
    private readonly tenantMembersService: TenantMembersService,
    private readonly managementService: InvitationManagementService,
  ) {}

  async createInvitation(
    createInvitationDto: CreateInvitationDto,
    tenantId: string,
    invitedBy: string,
    options?: { sendEmail?: boolean },
  ): Promise<IInvitationResponseDto> {
    const existingUser = await this.usersService.getUserByEmail(createInvitationDto.email);
    if (existingUser) {
      const existingMember = await this.tenantMembersService.findUserTenantMembership(
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
    const existingInvitation = existingInvitations.find(
      (inv) => inv.tenantId === tenantId && inv.status === InvitationStatus.PENDING,
    );
    if (existingInvitation) {
      throw new ConflictException(
        `An invitation has already been sent to ${createInvitationDto.email} for this tenant. Please wait for them to respond or resend the invitation.`,
      );
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const token = this.managementService.generateInvitationToken();
    const invitationData: Partial<Invitation> = {
      email: StringUtility.trimAndLowerCase(createInvitationDto.email),
      tenantId,
      role: createInvitationDto.role,
      invitedBy,
      expiresAt,
      status: InvitationStatus.PENDING,
      token,
      firstName: createInvitationDto.firstName?.trim() || undefined,
      lastName: createInvitationDto.lastName?.trim() || undefined,
      middleName: createInvitationDto.middleName,
      jobTitle: createInvitationDto.jobTitle,
      departmentId: createInvitationDto.departmentId,
      employmentType: createInvitationDto.employmentType,
      employeeNumber: createInvitationDto.employeeNumber,
      positionId: createInvitationDto.positionId,
    };
    let invitation: Invitation;
    try {
      invitation = await this.invitationsRepository.save(
        this.invitationsRepository.create(invitationData),
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { driverError?: { code?: string; column?: string } })
          .driverError?.code === '23502'
      ) {
        throw new BadRequestException(
          'Unable to save invitation without a name. Run database migrations (invitation-names-nullable) on this environment.',
        );
      }
      throw error;
    }
    const emailDelivery =
      options?.sendEmail === false
        ? { emailSent: false }
        : await this.managementService.sendInvitationEmail(invitation);
    return this.managementService.mapToResponseDto(invitation, emailDelivery);
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
    try {
      const employeeNumber = await this.tenantMembersService.getNextEmployeeNumber(tenantId);
      return await this.createInvitation(
        {
          email: inviteData.email,
          firstName: inviteData.firstName,
          lastName: inviteData.lastName,
          role: inviteData.role || TenantMemberRole.MEMBER,
          employeeNumber,
        },
        tenantId,
        invitedBy,
        { sendEmail: inviteData.sendWelcomeEmail !== false },
      );
    } catch (error) {
      this.logger.error('Error creating member invitation:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create invitation: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
