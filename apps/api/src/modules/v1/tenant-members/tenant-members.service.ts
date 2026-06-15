import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantMemberRole } from 'src/common/enums';
import { FileUrlService } from 'src/common/services/file-url.service';
import type { QueryDeepPartialEntity } from 'typeorm';
import { Repository } from 'typeorm';
import type { ICelebrationResponseDto } from '../../../common/interfaces/icelebration-response-dto.interface';
import type { INewHiresResponseDto } from '../../../common/interfaces/inew-hires-response-dto.interface';
import { TenantMemberCreatedEvent } from '../leave/events/leave.events';
import { TenantSettings } from '../tenant-settings/entities/tenant-settings.entity';
import type { CreateTenantMemberDto } from './dto/create-tenant-member.dto';
import type { UpdateTenantMemberDto } from './dto/update-tenant-member.dto';
import type { TenantMember } from './entities/tenant-member.entity';
import { TenantCounterRepository } from './repositories/tenant-counter.repository';
import { TenantMemberRepository } from './repositories/tenant-members.repository';

interface EmailQueueService {
  sendInvitationEmail(
    email: string,
    invitedBy: string,
    tenantId: string,
    inviteLink: string,
  ): Promise<void>;
}

@Injectable()
export class TenantMembersService {
  private readonly logger = new Logger(TenantMembersService.name);
  constructor(
    private readonly tenantMemberRepository: TenantMemberRepository,
    private readonly tenantCounterRepository: TenantCounterRepository,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(TenantSettings)
    private readonly tenantSettingsRepository: Repository<TenantSettings>,
    private readonly fileUrlService: FileUrlService,
    @Optional() private readonly emailQueueService?: EmailQueueService,
  ) {}
  async createTenantMember(
    userId: string,
    tenantId: string,
    createDto: CreateTenantMemberDto,
  ): Promise<TenantMember> {
    try {
      const existingMember = await this.tenantMemberRepository.findMembershipByUserAndTenant(
        userId,
        tenantId,
      );
      if (existingMember) {
        throw new BadRequestException('User is already a member of this tenant');
      }
      const employeeNumber = await this.getNextEmployeeNumber(tenantId);
      const memberData: Partial<TenantMember> = {
        userId,
        tenantId,
        role: createDto.role || TenantMemberRole.MEMBER,
        isActive: true,
        joinDate: new Date(),
        employeeNumber,
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        preferredName: createDto.preferredName ?? createDto.firstName,
      };
      const savedMember = await this.tenantMemberRepository.save(memberData);
      try {
        if (createDto.role !== TenantMemberRole.OWNER) {
          this.eventEmitter.emit(
            'tenant.member.created',
            new TenantMemberCreatedEvent(tenantId, savedMember.id, savedMember.joinDate),
          );
        }
      } catch (eventError) {
        this.logger.error('Error emitting tenant member created event:', eventError);
      }
      return savedMember;
    } catch (error) {
      this.logger.error('Error creating tenant member:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error.message?.includes('employee number')) {
        throw new BadRequestException('Failed to generate employee number for tenant member');
      }
      if (error.message?.includes('counter')) {
        throw new BadRequestException('Failed to initialize employee counter for tenant');
      }
      throw new BadRequestException(
        `Failed to create tenant member: ${error.message || 'Unknown error'}`,
      );
    }
  }
  async getTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.findAllMembersByTenantId(tenantId);
  }
  async listActiveTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.findTenantActiveMembers(tenantId);
  }
  async getTenantMemberId(tenantId: string, memberId: string): Promise<TenantMember> {
    return this.tenantMemberRepository.findByTenantAndMemberId(tenantId, memberId);
  }
  async getTenantMembersCount(tenantId: string): Promise<number> {
    return this.tenantMemberRepository.countByTenantId(tenantId);
  }
  async getTenantMemberProfile(userId: string, tenantId: string): Promise<TenantMember> {
    return this.checkUserTenantMembership(userId, tenantId);
  }
  async getTenantMember(id: string, tenantId: string): Promise<TenantMember> {
    const member: TenantMember | null = await this.tenantMemberRepository.findOne({
      where: { id },
      relations: [
        'user',
        'positionHistory',
        'positionHistory.position',
        'departmentMemberships',
        'departmentMemberships.department',
        'employments',
      ],
    });
    if (!member) {
      throw new NotFoundException('Tenant member not found');
    }
    if (tenantId && member.tenantId !== tenantId) {
      throw new ForbiddenException('Member does not belong to this tenant');
    }
    return member;
  }
  async findByEmail(email: string): Promise<TenantMember | null> {
    return this.tenantMemberRepository.findOne({
      where: {
        user: {
          email,
        },
      },
      relations: ['user'],
    });
  }
  async updateTenantMember(
    tenantId: string,
    userId: string,
    updateDto: UpdateTenantMemberDto,
  ): Promise<TenantMember> {
    const member = await this.getTenantMemberProfile(userId, tenantId);
    if (!member) throw new NotFoundException('Tenant member not found');

    const updateData: Partial<TenantMember> = {};
    if (updateDto.firstName !== undefined) updateData.firstName = updateDto.firstName;
    if (updateDto.lastName !== undefined) updateData.lastName = updateDto.lastName;
    if (updateDto.middleName !== undefined) updateData.middleName = updateDto.middleName;
    if (updateDto.preferredName !== undefined) {
      updateData.preferredName = updateDto.preferredName;
    }
    if (updateDto.phone !== undefined) updateData.phone = updateDto.phone;
    if (updateDto.dateOfBirth !== undefined) {
      updateData.dateOfBirth = updateDto.dateOfBirth;
    }
    if (updateDto.gender !== undefined) updateData.gender = updateDto.gender;
    if (updateDto.role !== undefined) updateData.role = updateDto.role;
    if (updateDto.avatarKey !== undefined) updateData.avatarKey = updateDto.avatarKey;

    if (Object.keys(updateData).length > 0) {
      await this.tenantMemberRepository.update(
        member.id,
        updateData as QueryDeepPartialEntity<TenantMember>,
      );
    }

    return this.getTenantMember(member.id, tenantId);
  }
  async removeTenantMember(userId: string, tenantId: string): Promise<void> {
    const member = await this.getTenantMemberProfile(userId, tenantId);
    await this.tenantMemberRepository.update(member.id, {
      isActive: false,
      leaveDate: new Date(),
    });
  }
  async setTenantMemberStatus(
    userId: string,
    tenantId: string,
    isActive: boolean,
  ): Promise<TenantMember> {
    const member = await this.getTenantMemberProfile(userId, tenantId);
    const updateData: QueryDeepPartialEntity<TenantMember> = { isActive };
    if (!isActive && !member.leaveDate) {
      updateData.leaveDate = new Date();
    }
    await this.tenantMemberRepository.update(member.id, updateData);
    if (isActive && member.leaveDate) {
      await this.tenantMemberRepository.update(member.id, {
        leaveDate: () => 'NULL',
      } as QueryDeepPartialEntity<TenantMember>);
    }
    return this.getTenantMember(member.id, tenantId);
  }
  async updateTenantMemberStatus(
    memberId: string,
    tenantId: string,
    isActive: boolean,
  ): Promise<TenantMember> {
    const member = await this.getTenantMember(memberId, tenantId);
    return this.setTenantMemberStatus(member.userId, tenantId, isActive);
  }
  async updateTenantMemberById(
    memberId: string,
    tenantId: string,
    updateDto: UpdateTenantMemberDto,
  ): Promise<TenantMember> {
    const member = await this.getTenantMember(memberId, tenantId);
    return this.updateTenantMember(tenantId, member.userId, updateDto);
  }
  async restoreTenantMember(memberId: string): Promise<void> {
    const result = await this.tenantMemberRepository.restore(memberId);
    if (result.affected === 0) {
      throw new NotFoundException('Tenant Member not found');
    }
  }
  async checkUserTenantMembership(userId: string, tenantId: string): Promise<TenantMember> {
    return this.tenantMemberRepository.findByUserAndTenantId(userId, tenantId);
  }
  async isUserInTenant(userId: string, tenantId: string): Promise<boolean> {
    return this.tenantMemberRepository.countUserInTenant(userId, tenantId);
  }
  async getUserMemberships(userId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.findByUserId(userId);
  }
  async listTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.findAllMembersByTenantId(tenantId);
  }
  async getTenantMembersByDepartment(departmentId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: {
        departmentMemberships: {
          departmentId,
          isActive: true,
        },
      },
      relations: ['user', 'departmentMemberships'],
    });
  }
  async getTenantOwners(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: {
        tenantId,
        role: TenantMemberRole.OWNER,
      },
      relations: ['user'],
    });
  }
  async listTenantOwners(): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: {
        role: TenantMemberRole.OWNER,
      },
      relations: ['user'],
    });
  }
  private async getNextEmployeeNumber(tenantId: string): Promise<string> {
    try {
      let numberPrefix = '';
      let numberPadding = 3;
      try {
        const settings = await this.tenantSettingsRepository.findOne({ where: { tenantId } });
        if (settings?.settings?.employee) {
          numberPrefix = settings.settings.employee.numberPrefix || '';
          numberPadding = settings.settings.employee.numberPadding || 3;
        }
      } catch (configError) {
        this.logger.warn(
          'Tenant config not found, using defaults for employee number generation:',
          configError,
        );
      }
      await this.tenantCounterRepository.getOrCreateCounter(
        tenantId,
        'employee_number',
        0,
        numberPrefix,
        undefined,
        numberPadding,
      );
      await this.tenantCounterRepository.incrementCounter(tenantId, 'employee_number');
      const currentValue = await this.tenantCounterRepository.getCurrentValue(
        tenantId,
        'employee_number',
      );
      return currentValue.toString().padStart(numberPadding, '0');
    } catch (error) {
      this.logger.error('Error generating employee number:', error);
      throw new BadRequestException('Failed to generate employee number');
    }
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
  ) {
    try {
      const existingMember = await this.findByEmail(inviteData.email);
      if (existingMember && existingMember.tenantId === tenantId) {
        throw new BadRequestException('User is already a member of this tenant');
      }
      const employeeNumber = await this.getNextEmployeeNumber(tenantId);
      const invitationData = {
        tenantId,
        email: inviteData.email,
        firstName: inviteData.firstName,
        lastName: inviteData.lastName,
        role: inviteData.role || TenantMemberRole.MEMBER,
        employeeNumber,
        invitedBy,
        invitedAt: new Date(),
        status: 'pending',
      };
      const { randomBytes } = await import('node:crypto');
      const invitation = {
        id: `inv_${Date.now()}_${randomBytes(8).toString('hex')}`,
        ...invitationData,
      };
      this.logger.log(`Invitation created for ${inviteData.email} to tenant ${tenantId}`);
      if (inviteData.sendWelcomeEmail && this.emailQueueService) {
        try {
          const inviteLink = `${process.env.FRONTEND_URL || 'https://app.teamlyf.com'}/accept-invitation/${invitation.id}`;
          await this.emailQueueService.sendInvitationEmail(
            inviteData.email,
            invitedBy,
            tenantId,
            inviteLink,
          );
          this.logger.log(`Invitation email sent to ${inviteData.email}`);
        } catch (emailError) {
          this.logger.error(`Failed to send invitation email to ${inviteData.email}:`, emailError);
        }
      }
      return invitation;
    } catch (error) {
      this.logger.error('Error creating member invitation:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create invitation: ${error.message}`);
    }
  }
  async getNewHires(tenantId: string, months: number = 2): Promise<INewHiresResponseDto[]> {
    const members = await this.tenantMemberRepository.findNewHires(tenantId, months);
    return (members as TenantMember[]).map((member) => {
      const currentPosition = member.positionHistory?.find((p) => p.isCurrent);
      const activeDepartmentMembership = member.departmentMemberships?.find((dm) => dm.isActive);
      return {
        id: member.id,
        firstName: member.firstName ?? '',
        lastName: member.lastName ?? '',
        preferredName: member.preferredName ?? undefined,
        employeeNumber: member.employeeNumber,
        joinDate: member.joinDate,
        avatarUrl:
          member.avatarKey && member.tenantId
            ? this.fileUrlService.getMemberAvatarUrl(member.tenantId, member.avatarKey) || undefined
            : undefined,
        positionTitle: currentPosition?.position?.title,
        departmentName: activeDepartmentMembership?.department?.name,
      };
    });
  }
  async getUpcomingCelebrations(tenantId: string): Promise<ICelebrationResponseDto[]> {
    return this.tenantMemberRepository.findUpcomingCelebrations(tenantId);
  }
}
