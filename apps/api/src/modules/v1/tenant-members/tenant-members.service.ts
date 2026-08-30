import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { EmploymentStatus, TenantMemberPermission, TenantMemberRole } from 'src/common/enums';
import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import type { MemberContext } from 'src/common/interfaces';
import { EncryptionService } from 'src/common/services/encryption.service';
import { FileUrlService } from 'src/common/services/file-url.service';
import { formatMemberDisplayName } from 'src/common/utils/member-display.util';
import type { EntityManager, QueryDeepPartialEntity } from 'typeorm';
import { In, IsNull, Repository } from 'typeorm';
import type { ICelebrationResponseDto } from '../../../common/interfaces/icelebration-response-dto.interface';
import type { INewHiresResponseDto } from '../../../common/interfaces/inew-hires-response-dto.interface';
import { ActivitiesService } from '../activities/services/activities.service';
import { Address } from '../address/entities/address.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Department } from '../departments/entities/department.entity';
import { DepartmentMember } from '../departments/entities/department-member.entity';
import { Document } from '../document/entities/document.entity';
import { Education } from '../education/entities/education.entity';
import { EmergencyContact } from '../emergency-contact/entities/emergency-contact.entity';
import { Employment } from '../employment/entities/employment.entity';
import { Leave } from '../leave/entities/leave.entity';
import {
  ProfileUpdatedEvent,
  TenantMemberChangedEvent,
  TenantMemberCreatedEvent,
} from '../leave/events/leave.events';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { PaymentMethod } from '../payment-method/entities/payment-method.entity';
import { PayrollItem } from '../payroll/entities/payroll-item.entity';
import { TenantSettings } from '../tenant-settings/entities/tenant-settings.entity';
import type { CreateTenantMemberDto } from './dto/create-tenant-member.dto';
import type { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import type { UpdateTenantMemberDto } from './dto/update-tenant-member.dto';
import { TenantMember } from './entities/tenant-member.entity';
import { TenantCounterRepository } from './repositories/tenant-counter.repository';
import { TenantMemberRepository } from './repositories/tenant-members.repository';
import { describeChangedFields, pickChangedFields } from './utils/member-activity-diff.util';

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
    @InjectRepository(Employment)
    private readonly employmentRepository: Repository<Employment>,
    @InjectRepository(DepartmentMember)
    private readonly departmentMemberRepository: Repository<DepartmentMember>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Leave)
    private readonly leaveRepository: Repository<Leave>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(Education)
    private readonly educationRepository: Repository<Education>,
    @InjectRepository(EmergencyContact)
    private readonly emergencyContactRepository: Repository<EmergencyContact>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepository: Repository<PayrollItem>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(NotificationPreference)
    private readonly notificationPreferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly fileUrlService: FileUrlService,
    private readonly encryptionService: EncryptionService,
    private readonly activitiesService: ActivitiesService,
    @Optional() private readonly emailQueueService?: EmailQueueService,
  ) {}

  private memberDisplayName(
    member: Pick<TenantMember, 'firstName' | 'lastName' | 'middleName' | 'preferredName'> | null,
  ): string {
    return formatMemberDisplayName(member) ?? 'Member';
  }

  private activeDepartmentName(member: TenantMember): string {
    const membership = member.departmentMemberships?.find((dm) => dm.isActive);
    return membership?.department?.name?.trim() || 'None';
  }

  private activeReportsToId(member: TenantMember): string | null {
    const employment = member.employments?.find((e) => e.status === EmploymentStatus.ACTIVE);
    return employment?.reportsToId ?? null;
  }

  private async resolveMemberLabel(memberId: string | null, tenantId: string): Promise<string> {
    if (!memberId) return 'None';
    const manager = await this.tenantMemberRepository.findOne({
      where: { id: memberId, tenantId },
      select: ['id', 'firstName', 'lastName', 'middleName', 'preferredName'],
    });
    return this.memberDisplayName(manager);
  }

  private async snapshotOrgFields(
    member: TenantMember,
    tenantId: string,
  ): Promise<Record<string, string>> {
    return {
      role: member.role,
      permissions: (member.permissions ?? []).join(', ') || 'None',
      department: this.activeDepartmentName(member),
      reportsTo: await this.resolveMemberLabel(this.activeReportsToId(member), tenantId),
    };
  }

  private snapshotProfileFields(member: TenantMember): Record<string, string> {
    return {
      firstName: member.firstName?.trim() || '—',
      lastName: member.lastName?.trim() || '—',
      middleName: member.middleName?.trim() || '—',
      preferredName: member.preferredName?.trim() || '—',
      phone: member.phone?.trim() || '—',
      dateOfBirth: member.dateOfBirth
        ? new Date(member.dateOfBirth).toISOString().slice(0, 10)
        : '—',
      gender: member.gender ? String(member.gender) : '—',
      avatar: member.avatarKey?.trim() ? 'Set' : 'None',
      identityDocuments:
        member.identityBvn?.trim() || member.identityNin?.trim() ? 'On file' : 'None',
    };
  }

  private queueMemberActivity(payload: {
    tenantId: string;
    actorMemberId: string;
    action: string;
    resourceId: string;
    description: string;
    beforeData: Record<string, string>;
    afterData: Record<string, string>;
  }): void {
    void this.activitiesService
      .queueActivity({
        tenantId: payload.tenantId,
        actorMemberId: payload.actorMemberId,
        action: payload.action,
        resourceType: 'member',
        resourceId: payload.resourceId,
        description: payload.description,
        metadata: {
          beforeData: payload.beforeData,
          afterData: payload.afterData,
        },
      })
      .catch(() => {});
  }
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
        this.eventEmitter.emit(
          'tenant.member.created',
          new TenantMemberCreatedEvent(tenantId, savedMember.id, savedMember.joinDate),
        );
        this.eventEmitter.emit('tenant.member.changed', new TenantMemberChangedEvent(tenantId));
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
  async getTenantMembersByIds(tenantId: string, memberIds: string[]): Promise<TenantMember[]> {
    if (memberIds.length === 0) return [];
    return this.tenantMemberRepository.findByIdsAndTenantId(tenantId, memberIds);
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
    updateDto: UpdateMemberProfileDto,
  ): Promise<TenantMember> {
    const member = await this.getTenantMemberProfile(userId, tenantId);
    if (!member) throw new NotFoundException('Tenant member not found');
    await this.assertIdentityUpdateAllowed(tenantId, updateDto, true);
    await this.applyProfileUpdates(member, updateDto);
    return this.getTenantMember(member.id, tenantId);
  }
  async updateTenantMemberProfileById(
    memberId: string,
    tenantId: string,
    updateDto: UpdateMemberProfileDto,
    actorMemberId: string,
  ): Promise<TenantMember> {
    const member = await this.getTenantMember(memberId, tenantId);
    const isSelf = actorMemberId === memberId;
    await this.assertIdentityUpdateAllowed(tenantId, updateDto, isSelf);
    const before = this.snapshotProfileFields(member);
    await this.applyProfileUpdates(member, updateDto);
    const updated = await this.getTenantMember(memberId, tenantId);
    const after = this.snapshotProfileFields(updated);
    const { beforeData, afterData } = pickChangedFields(before, after);
    const changedKeys = Object.keys(afterData);
    if (changedKeys.length > 0) {
      const name = this.memberDisplayName(updated);
      this.queueMemberActivity({
        tenantId,
        actorMemberId,
        action: 'member.profile_updated',
        resourceId: memberId,
        description: `Updated ${name}'s ${describeChangedFields(changedKeys)}`,
        beforeData,
        afterData,
      });

      if (!isSelf) {
        const updatedBy = this.memberDisplayName(
          await this.getTenantMember(actorMemberId, tenantId),
        );
        this.eventEmitter.emit(
          'profile.updated',
          new ProfileUpdatedEvent(memberId, tenantId, {
            updatedBy,
            updatedFields: changedKeys,
          }),
        );
      }
    }
    return updated;
  }
  async updateTenantMemberById(
    memberId: string,
    tenantId: string,
    updateDto: UpdateTenantMemberDto,
    actor: MemberContext,
  ): Promise<TenantMember> {
    const isAdmin = actor.role === TenantMemberRole.ADMIN || actor.role === TenantMemberRole.OWNER;
    const canManageOrganization =
      isAdmin || actor.permissions?.includes(TenantMemberPermission.MANAGE_EMPLOYEE_ORGANIZATION);
    if (!canManageOrganization) {
      throw new ForbiddenException('Employee organization management access is required');
    }
    if (!isAdmin && (updateDto.role !== undefined || updateDto.permissions !== undefined)) {
      throw new ForbiddenException('Only workspace admins can change roles or permissions');
    }
    if (updateDto.permissions !== undefined && actor.role !== TenantMemberRole.OWNER) {
      throw new ForbiddenException('Only the workspace owner can grant or revoke permissions');
    }
    const member = await this.getTenantMember(memberId, tenantId);
    const before = await this.snapshotOrgFields(member, tenantId);
    await this.applyOrgUpdates(member, tenantId, updateDto);
    const updated = await this.getTenantMember(memberId, tenantId);
    const after = await this.snapshotOrgFields(updated, tenantId);
    const { beforeData, afterData } = pickChangedFields(before, after);
    const changedKeys = Object.keys(afterData);
    if (changedKeys.length > 0) {
      const name = this.memberDisplayName(updated);
      this.queueMemberActivity({
        tenantId,
        actorMemberId: actor.id,
        action: 'member.updated',
        resourceId: memberId,
        description: `Updated ${name}'s ${describeChangedFields(changedKeys)}`,
        beforeData,
        afterData,
      });
    }
    return updated;
  }

  private async assertIdentityUpdateAllowed(
    tenantId: string,
    updateDto: UpdateMemberProfileDto,
    isSelf: boolean,
  ): Promise<void> {
    const hasIdentityUpdate =
      updateDto.identityBvn !== undefined || updateDto.identityNin !== undefined;
    if (!hasIdentityUpdate) {
      return;
    }

    if (!isSelf) {
      throw new ForbiddenException('Identity details can only be updated by the employee');
    }

    const settings = await this.tenantSettingsRepository.findOne({ where: { tenantId } });
    if (settings?.settings?.employee?.requireIdentityForPayroll !== true) {
      throw new BadRequestException('Identity collection is not enabled for this workspace');
    }
  }

  private async applyProfileUpdates(
    member: TenantMember,
    updateDto: UpdateMemberProfileDto,
  ): Promise<void> {
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
    if (updateDto.avatarKey !== undefined) updateData.avatarKey = updateDto.avatarKey;
    if (updateDto.identityBvn !== undefined) {
      updateData.identityBvn = updateDto.identityBvn.trim()
        ? this.encryptionService.encrypt(updateDto.identityBvn.trim())
        : null;
    }
    if (updateDto.identityNin !== undefined) {
      updateData.identityNin = updateDto.identityNin.trim()
        ? this.encryptionService.encrypt(updateDto.identityNin.trim())
        : null;
    }

    if (Object.keys(updateData).length > 0) {
      await this.tenantMemberRepository.update(
        member.id,
        updateData as QueryDeepPartialEntity<TenantMember>,
      );
    }
  }
  private async applyOrgUpdates(
    member: TenantMember,
    tenantId: string,
    updateDto: UpdateTenantMemberDto,
  ): Promise<void> {
    const updateData: Partial<TenantMember> = {};
    if (updateDto.role !== undefined) {
      if (member.role === TenantMemberRole.OWNER) {
        throw new BadRequestException('Cannot change workspace role of the owner');
      }
      if (updateDto.role === TenantMemberRole.OWNER) {
        throw new BadRequestException('Cannot assign owner role via member update');
      }
      updateData.role = updateDto.role;
    }
    if (updateDto.permissions !== undefined) {
      updateData.permissions = [...new Set(updateDto.permissions)];
    }

    if (Object.keys(updateData).length > 0) {
      await this.tenantMemberRepository.update(
        member.id,
        updateData as QueryDeepPartialEntity<TenantMember>,
      );
    }

    if (updateDto.departmentId !== undefined) {
      await this.updateMemberDepartment(tenantId, member.id, updateDto.departmentId || null);
    }

    if (updateDto.reportsToId !== undefined) {
      await this.updateMemberReportsTo(tenantId, member.id, updateDto.reportsToId || null);
    }

    if (
      updateDto.departmentId !== undefined ||
      updateDto.reportsToId !== undefined ||
      updateDto.role !== undefined ||
      updateDto.permissions !== undefined
    ) {
      this.eventEmitter.emit('tenant.member.changed', new TenantMemberChangedEvent(tenantId));
    }
  }
  private async updateMemberDepartment(
    tenantId: string,
    memberId: string,
    departmentId: string | null,
  ): Promise<void> {
    const activeMemberships = await this.departmentMemberRepository.find({
      where: { memberId, isActive: true },
      relations: ['department'],
    });
    const tenantMemberships = activeMemberships.filter(
      (membership) => membership.department?.tenantId === tenantId,
    );

    if (!departmentId) {
      for (const membership of tenantMemberships) {
        await this.departmentMemberRepository.delete(membership.id);
      }
      return;
    }

    const department = await this.departmentRepository.findOne({
      where: { id: departmentId, tenantId },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (tenantMemberships.some((membership) => membership.departmentId === departmentId)) {
      return;
    }

    for (const membership of tenantMemberships) {
      await this.departmentMemberRepository.delete(membership.id);
    }

    const existingMembership = await this.departmentMemberRepository.findOne({
      where: { departmentId, memberId },
    });
    if (existingMembership) {
      await this.departmentMemberRepository.update(existingMembership.id, {
        isActive: true,
        joinedAt: new Date(),
      });
      return;
    }

    await this.departmentMemberRepository.save(
      this.departmentMemberRepository.create({
        departmentId,
        memberId,
        role: 'MEMBER',
        joinedAt: new Date(),
        isActive: true,
      }),
    );
  }
  private async updateMemberReportsTo(
    tenantId: string,
    memberId: string,
    reportsToId: string | null,
  ): Promise<void> {
    if (reportsToId === memberId) {
      throw new BadRequestException('A member cannot report to themselves');
    }

    if (reportsToId) {
      const manager = await this.tenantMemberRepository.findOne({
        where: { id: reportsToId, tenantId, isActive: true },
      });
      if (!manager) {
        throw new NotFoundException('Manager not found in this workspace');
      }
    }

    const employment = await this.employmentRepository.findOne({
      where: { tenantMemberId: memberId, tenantId, endDate: IsNull() },
    });

    if (employment) {
      await this.employmentRepository.update(employment.id, {
        reportsToId: reportsToId ?? undefined,
      });
      return;
    }

    if (!reportsToId) {
      return;
    }

    const member = await this.getTenantMember(memberId, tenantId);
    await this.employmentRepository.save(
      this.employmentRepository.create({
        tenantMemberId: memberId,
        tenantId,
        startDate: member.joinDate ?? new Date(),
        payRate: 0,
        reportsToId,
        status: EmploymentStatus.ACTIVE,
      }),
    );
  }
  async removeTenantMember(userId: string, tenantId: string, actorMemberId: string): Promise<void> {
    const member = await this.getTenantMemberProfile(userId, tenantId);
    await this.tenantMemberRepository.update(member.id, {
      isActive: false,
      leaveDate: new Date(),
    });
    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId,
        action: 'member.removed',
        resourceType: 'member',
        resourceId: member.id,
        description: `Removed ${this.memberDisplayName(member)} from the workspace`,
      })
      .catch(() => {});
    this.eventEmitter.emit('tenant.member.changed', new TenantMemberChangedEvent(tenantId));
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
    this.eventEmitter.emit('tenant.member.changed', new TenantMemberChangedEvent(tenantId));
    return this.getTenantMember(member.id, tenantId);
  }
  async updateTenantMemberStatus(
    memberId: string,
    tenantId: string,
    isActive: boolean,
    actorMemberId: string,
  ): Promise<TenantMember> {
    const member = await this.getTenantMember(memberId, tenantId);
    const updated = await this.setTenantMemberStatus(member.userId, tenantId, isActive);
    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId,
        action: isActive ? 'member.reactivated' : 'member.deactivated',
        resourceType: 'member',
        resourceId: memberId,
        description: isActive
          ? `Reactivated ${this.memberDisplayName(member)}`
          : `Deactivated ${this.memberDisplayName(member)}`,
        metadata: {
          beforeData: { status: isActive ? 'Inactive' : 'Active' },
          afterData: { status: isActive ? 'Active' : 'Inactive' },
        },
      })
      .catch(() => {});
    return updated;
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
  async findUserTenantMembership(userId: string, tenantId: string): Promise<TenantMember | null> {
    return this.tenantMemberRepository.findMembershipByUserAndTenant(userId, tenantId);
  }
  async findTenantMemberUserIds(tenantId: string, userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }
    const members = await this.tenantMemberRepository.find({
      where: { tenantId, userId: In([...new Set(userIds)]) },
      select: ['userId'],
    });
    return new Set(members.map((member) => member.userId));
  }
  async memberExistsInTenant(tenantId: string, memberId: string): Promise<boolean> {
    const member = await this.tenantMemberRepository.findOne({
      where: { id: memberId, tenantId },
      select: ['id'],
    });
    return !!member;
  }
  async filterTenantMemberIds(tenantId: string, memberIds: string[]): Promise<Set<string>> {
    if (memberIds.length === 0) {
      return new Set();
    }
    const members = await this.tenantMemberRepository.find({
      where: { tenantId, id: In([...new Set(memberIds)]) },
      select: ['id'],
    });
    return new Set(members.map((member) => member.id));
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
      if (inviteData.sendWelcomeEmail && this.emailQueueService) {
        try {
          const inviteLink = `${process.env.FRONTEND_URL || 'https://app.teamlyf.com'}/accept-invitation/${invitation.id}`;
          await this.emailQueueService.sendInvitationEmail(
            inviteData.email,
            invitedBy,
            tenantId,
            inviteLink,
          );
        } catch (emailError) {
          this.logger.error('Failed to send invitation email', emailError);
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

  findMembersWithBirthdayToday(tenantId: string) {
    return this.tenantMemberRepository.findMembersWithBirthdayToday(tenantId);
  }

  findMembersWithWorkAnniversaryToday(tenantId: string) {
    return this.tenantMemberRepository.findMembersWithWorkAnniversaryToday(tenantId);
  }

  /**
   * Scrub HR PII for all memberships of a user. Must run inside a shared transaction.
   */
  async scrubPersonalData(
    userId: string,
    manager: EntityManager,
  ): Promise<{ membershipCount: number; fileKeys: string[] }> {
    const memberRepo = manager.getRepository(TenantMember);
    const members = await memberRepo.find({
      where: { userId },
      select: ['id', 'avatarKey'],
    });
    const memberIds = members.map((member) => member.id);
    const fileKeys: string[] = [];

    for (const member of members) {
      if (member.avatarKey) {
        fileKeys.push(member.avatarKey);
      }
    }

    if (memberIds.length === 0) {
      return { membershipCount: 0, fileKeys };
    }

    const documentRepo = manager.getRepository(Document);
    const memberDocuments = await documentRepo.find({
      where: { tenantMemberId: In(memberIds) },
      select: ['id', 'fileKey'],
    });
    for (const document of memberDocuments) {
      if (document.fileKey) {
        fileKeys.push(document.fileKey);
      }
    }

    await manager
      .getRepository(PaymentMethod)
      .createQueryBuilder()
      .update(PaymentMethod)
      .set({
        accountNumber: null,
        accountName: null,
        bankCode: null,
        bankName: null,
        passcodeHash: null,
        status: PaymentMethodStatus.SUSPENDED,
        isPrimary: false,
      })
      .where('member_id IN (:...memberIds)', { memberIds })
      .execute();

    await Promise.all([
      manager.getRepository(EmergencyContact).delete({ tenantMemberId: In(memberIds) }),
      manager.getRepository(Address).delete({ tenantMemberId: In(memberIds) }),
      manager.getRepository(Education).delete({ tenantMemberId: In(memberIds) }),
      manager
        .getRepository(Leave)
        .update({ requestedBy: In(memberIds) }, { reason: '', comments: '' }),
      manager.getRepository(Attendance).update({ tenantMemberId: In(memberIds) }, { notes: '' }),
      manager.getRepository(Employment).update({ tenantMemberId: In(memberIds) }, { comments: '' }),
      manager.getRepository(Notification).delete({ recipientId: In(memberIds) }),
      documentRepo.delete({ tenantMemberId: In(memberIds) }),
      memberRepo.update(
        { userId },
        {
          firstName: null,
          lastName: null,
          middleName: null,
          preferredName: null,
          phone: null,
          dateOfBirth: null,
          gender: null,
          identityBvn: null,
          identityNin: null,
          avatarKey: null,
          isActive: false,
          leaveDate: new Date(),
        },
      ),
    ]);
    await memberRepo.softDelete({ userId });

    return { membershipCount: members.length, fileKeys };
  }

  async loadPersonalDataForExport(userId: string): Promise<Record<string, unknown>> {
    const members = await this.tenantMemberRepository.find({
      where: { userId },
      relations: ['tenant'],
    });
    const memberIds = members.map((member) => member.id);

    if (memberIds.length === 0) {
      return {
        memberships: [],
        employment: [],
        documents: [],
        leaves: [],
        attendance: [],
        education: [],
        emergencyContacts: [],
        addresses: [],
        payrollItems: [],
        paymentMethods: [],
        notificationPreferences: [],
        notifications: [],
      };
    }

    const [
      employments,
      documents,
      leaves,
      attendances,
      educations,
      emergencyContacts,
      addresses,
      payrollItems,
      paymentMethods,
      notificationPreferences,
      notifications,
    ] = await Promise.all([
      this.employmentRepository.find({
        where: { tenantMemberId: In(memberIds) },
        select: [
          'id',
          'tenantMemberId',
          'tenantId',
          'startDate',
          'endDate',
          'status',
          'payType',
          'paySchedule',
          'payRate',
          'currency',
          'comments',
        ],
      }),
      this.documentRepository.find({
        where: { tenantMemberId: In(memberIds) },
        select: [
          'id',
          'tenantMemberId',
          'tenantId',
          'name',
          'type',
          'fileKey',
          'issueDate',
          'expiryDate',
          'description',
          'isVerified',
        ],
      }),
      this.leaveRepository.find({
        where: { requestedBy: In(memberIds) },
        select: [
          'id',
          'tenantId',
          'requestedBy',
          'leaveTypeId',
          'startDate',
          'endDate',
          'duration',
          'status',
          'reason',
          'comments',
        ],
      }),
      this.attendanceRepository.find({
        where: { tenantMemberId: In(memberIds) },
        select: [
          'id',
          'tenantMemberId',
          'tenantId',
          'date',
          'clockIn',
          'clockOut',
          'workHours',
          'status',
          'notes',
        ],
      }),
      this.educationRepository.find({
        where: { tenantMemberId: In(memberIds) },
        select: [
          'id',
          'tenantMemberId',
          'tenantId',
          'title',
          'degreeType',
          'institution',
          'fieldOfStudy',
          'startDate',
          'endDate',
          'description',
          'gpa',
        ],
      }),
      this.emergencyContactRepository.find({
        where: { tenantMemberId: In(memberIds) },
        select: [
          'id',
          'tenantMemberId',
          'tenantId',
          'fullName',
          'phoneNumber',
          'email',
          'relationship',
          'address',
          'isPrimary',
        ],
      }),
      this.addressRepository.find({
        where: { tenantMemberId: In(memberIds) },
        select: ['id', 'tenantMemberId', 'country', 'city', 'state', 'street', 'postalCode'],
      }),
      this.payrollItemRepository.find({
        where: { memberId: In(memberIds) },
        select: [
          'id',
          'memberId',
          'payrollRunId',
          'status',
          'baseSalary',
          'baseSalaryCurrency',
          'grossAmount',
          'adjustments',
          'deductions',
          'netAmount',
          'paymentCurrency',
          'paymentAmount',
          'exchangeRate',
          'paidAt',
          'description',
        ],
      }),
      this.paymentMethodRepository.find({
        where: { memberId: In(memberIds) },
        select: [
          'id',
          'memberId',
          'tenantId',
          'type',
          'currency',
          'bankName',
          'bankCode',
          'accountName',
          'accountNumber',
          'country',
          'isPrimary',
          'status',
          'displayName',
        ],
      }),
      this.notificationPreferenceRepository.find({
        where: { tenantMemberId: In(memberIds) },
        select: [
          'id',
          'tenantMemberId',
          'notificationType',
          'preferredChannel',
          'isEnabled',
          'emailEnabled',
          'inAppEnabled',
          'quietHoursStart',
          'quietHoursEnd',
          'quietDays',
        ],
      }),
      this.notificationRepository.find({
        where: { recipientId: In(memberIds) },
        select: [
          'id',
          'tenantId',
          'recipientId',
          'type',
          'channel',
          'priority',
          'status',
          'title',
          'message',
          'sentAt',
          'deliveredAt',
          'readAt',
          'expiresAt',
        ],
      }),
    ]);

    return {
      memberships: members.map((member) => ({
        id: member.id,
        tenantId: member.tenantId,
        tenantName: member.tenant?.name,
        role: member.role,
        firstName: member.firstName,
        lastName: member.lastName,
        phone: member.phone,
        dateOfBirth: member.dateOfBirth,
        gender: member.gender,
        identityBvn: this.decryptOptional(member.identityBvn),
        identityNin: this.decryptOptional(member.identityNin),
        joinDate: member.joinDate,
        leaveDate: member.leaveDate,
        isActive: member.isActive,
      })),
      employment: employments.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        tenantId: row.tenantId,
        startDate: row.startDate,
        endDate: row.endDate,
        status: row.status,
        payType: row.payType,
        paySchedule: row.paySchedule,
        payRate: row.payRate,
        currency: row.currency,
        comments: row.comments,
      })),
      documents: documents.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        tenantId: row.tenantId,
        name: row.name,
        type: row.type,
        fileKey: row.fileKey,
        issueDate: row.issueDate,
        expiryDate: row.expiryDate,
        description: row.description,
        isVerified: row.isVerified,
      })),
      leaves: leaves.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        requestedBy: row.requestedBy,
        leaveTypeId: row.leaveTypeId,
        startDate: row.startDate,
        endDate: row.endDate,
        duration: row.duration,
        status: row.status,
        reason: row.reason,
        comments: row.comments,
      })),
      attendance: attendances.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        tenantId: row.tenantId,
        date: row.date,
        clockIn: row.clockIn,
        clockOut: row.clockOut,
        workHours: row.workHours,
        status: row.status,
        notes: row.notes,
      })),
      education: educations.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        tenantId: row.tenantId,
        title: row.title,
        degreeType: row.degreeType,
        institution: row.institution,
        fieldOfStudy: row.fieldOfStudy,
        startDate: row.startDate,
        endDate: row.endDate,
        description: row.description,
        gpa: row.gpa,
      })),
      emergencyContacts: emergencyContacts.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        tenantId: row.tenantId,
        fullName: row.fullName,
        phoneNumber: row.phoneNumber,
        email: row.email,
        relationship: row.relationship,
        address: row.address,
        isPrimary: row.isPrimary,
      })),
      addresses: addresses.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        country: row.country,
        city: row.city,
        state: row.state,
        street: row.street,
        postalCode: row.postalCode,
      })),
      payrollItems: payrollItems.map((row) => ({
        id: row.id,
        memberId: row.memberId,
        payrollRunId: row.payrollRunId,
        status: row.status,
        baseSalary: row.baseSalary,
        baseSalaryCurrency: row.baseSalaryCurrency,
        grossAmount: row.grossAmount,
        adjustments: row.adjustments,
        deductions: row.deductions,
        netAmount: row.netAmount,
        paymentCurrency: row.paymentCurrency,
        paymentAmount: row.paymentAmount,
        exchangeRate: row.exchangeRate,
        paidAt: row.paidAt,
        description: row.description,
      })),
      paymentMethods: paymentMethods.map((row) => ({
        id: row.id,
        memberId: row.memberId,
        tenantId: row.tenantId,
        type: row.type,
        currency: row.currency,
        bankName: row.bankName,
        bankCode: row.bankCode,
        accountName: this.decryptOptional(row.accountName),
        accountNumber: this.decryptOptional(row.accountNumber),
        country: row.country,
        isPrimary: row.isPrimary,
        status: row.status,
        displayName: row.displayName,
      })),
      notificationPreferences: notificationPreferences.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        notificationType: row.notificationType,
        preferredChannel: row.preferredChannel,
        isEnabled: row.isEnabled,
        emailEnabled: row.emailEnabled,
        inAppEnabled: row.inAppEnabled,
        quietHoursStart: row.quietHoursStart,
        quietHoursEnd: row.quietHoursEnd,
        quietDays: row.quietDays,
      })),
      notifications: notifications.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        recipientId: row.recipientId,
        type: row.type,
        channel: row.channel,
        priority: row.priority,
        status: row.status,
        title: row.title,
        message: row.message,
        sentAt: row.sentAt,
        deliveredAt: row.deliveredAt,
        readAt: row.readAt,
        expiresAt: row.expiresAt,
      })),
    };
  }

  private decryptOptional(value?: string | null): string | null {
    if (!value?.trim()) {
      return null;
    }
    try {
      return this.encryptionService.decrypt(value);
    } catch {
      return null;
    }
  }
}
