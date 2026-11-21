import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantMemberRole } from 'src/common/enums';
import type { QueryDeepPartialEntity } from 'typeorm';
import { type EntityManager, QueryFailedError, Repository } from 'typeorm';

import {
  TenantMemberChangedEvent,
  TenantMemberCreatedEvent,
} from '../../leave/events/leave.events';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import type { CreateTenantMemberDto } from '../dto/create-tenant-member.dto';
import { TenantMember } from '../entities/tenant-member.entity';
import { TenantCounterRepository } from '../repositories/tenant-counter.repository';
import { TenantMemberRepository } from '../repositories/tenant-members.repository';
import { PRIVILEGED_ROLES } from '../utils/member-role-policy.util';
import { MemberActivityService } from './member-activity.service';
import { MemberReadService } from './member-read.service';

interface LifecycleActor {
  id: string;
  role: string;
}

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class MemberLifecycleService {
  private readonly logger = new Logger(MemberLifecycleService.name);

  constructor(
    private readonly tenantMemberRepository: TenantMemberRepository,
    private readonly tenantCounterRepository: TenantCounterRepository,
    @InjectRepository(TenantSettings)
    private readonly tenantSettingsRepository: Repository<TenantSettings>,
    private readonly eventEmitter: EventEmitter2,
    private readonly readService: MemberReadService,
    private readonly activityService: MemberActivityService,
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
      this.logger.error(
        'Error creating tenant member',
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof QueryFailedError && error.driverError?.code === UNIQUE_VIOLATION) {
        throw new ConflictException('Tenant member already exists');
      }
      throw new BadRequestException('Failed to create tenant member');
    }
  }

  async removeTenantMember(
    memberId: string,
    tenantId: string,
    actor: LifecycleActor,
  ): Promise<void> {
    const member = await this.tenantMemberRepository.withTenantLock(tenantId, async (manager) => {
      const target = await this.loadGuardedTarget(memberId, tenantId, actor, true, manager);
      await manager.update(TenantMember, target.id, { isActive: false, leaveDate: new Date() });
      return target;
    });
    this.activityService.emitActivity({
      tenantId,
      actorMemberId: actor.id,
      action: 'member.removed',
      resourceType: 'member',
      resourceId: member.id,
      description: `Removed ${this.activityService.memberDisplayName(member)} from the workspace`,
    });
    this.eventEmitter.emit('tenant.member.changed', new TenantMemberChangedEvent(tenantId));
  }

  private async loadGuardedTarget(
    memberId: string,
    tenantId: string,
    actor: LifecycleActor,
    deactivating: boolean,
    manager: EntityManager,
  ): Promise<TenantMember> {
    const member = await this.tenantMemberRepository.findLifecycleTarget(
      memberId,
      tenantId,
      manager,
    );
    if (!member) {
      throw new NotFoundException('Tenant member not found');
    }
    if (actor.role !== TenantMemberRole.OWNER && PRIVILEGED_ROLES.includes(member.role)) {
      throw new ForbiddenException('Only an owner can change an admin or owner');
    }
    if (deactivating && member.role === TenantMemberRole.OWNER && member.isActive) {
      const activeOwners = await this.tenantMemberRepository.countActiveOwners(tenantId, manager);
      if (activeOwners <= 1) {
        throw new ConflictException('A workspace must keep at least one active owner');
      }
    }
    return member;
  }

  async setTenantMemberStatus(
    userId: string,
    tenantId: string,
    isActive: boolean,
  ): Promise<TenantMember> {
    const member = await this.readService.getTenantMemberProfile(userId, tenantId);
    await this.writeStatus(member, isActive);
    this.eventEmitter.emit('tenant.member.changed', new TenantMemberChangedEvent(tenantId));
    return this.readService.getTenantMember(member.id, tenantId);
  }

  private async writeStatus(
    member: Pick<TenantMember, 'id' | 'leaveDate'>,
    isActive: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    const update = (data: QueryDeepPartialEntity<TenantMember>) =>
      manager
        ? manager.update(TenantMember, member.id, data)
        : this.tenantMemberRepository.update(member.id, data);
    const updateData: QueryDeepPartialEntity<TenantMember> = { isActive };
    if (!isActive && !member.leaveDate) {
      updateData.leaveDate = new Date();
    }
    await update(updateData);
    if (isActive && member.leaveDate) {
      await update({ leaveDate: () => 'NULL' } as QueryDeepPartialEntity<TenantMember>);
    }
  }

  async updateTenantMemberStatus(
    memberId: string,
    tenantId: string,
    isActive: boolean,
    actor: LifecycleActor,
  ): Promise<TenantMember> {
    const member = await this.tenantMemberRepository.withTenantLock(tenantId, async (manager) => {
      const target = await this.loadGuardedTarget(memberId, tenantId, actor, !isActive, manager);
      await this.writeStatus(target, isActive, manager);
      return target;
    });
    this.eventEmitter.emit('tenant.member.changed', new TenantMemberChangedEvent(tenantId));
    const updated = await this.readService.getTenantMember(member.id, tenantId);
    this.activityService.emitActivity({
      tenantId,
      actorMemberId: actor.id,
      action: isActive ? 'member.reactivated' : 'member.deactivated',
      resourceType: 'member',
      resourceId: memberId,
      description: isActive
        ? `Reactivated ${this.activityService.memberDisplayName(member)}`
        : `Deactivated ${this.activityService.memberDisplayName(member)}`,
      metadata: {
        beforeData: { status: isActive ? 'Inactive' : 'Active' },
        afterData: { status: isActive ? 'Active' : 'Inactive' },
      },
    });
    return updated;
  }

  async restoreTenantMember(memberId: string): Promise<void> {
    const result = await this.tenantMemberRepository.restore(memberId);
    if (result.affected === 0) {
      throw new NotFoundException('Tenant Member not found');
    }
  }

  async getNextEmployeeNumber(tenantId: string): Promise<string> {
    try {
      let numberPrefix = '';
      let numberPadding = 3;
      try {
        const settings = await this.tenantSettingsRepository.findOne({
          where: { tenantId },
        });
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
      const currentValue = await this.tenantCounterRepository.nextValue(
        tenantId,
        'employee_number',
        { prefix: numberPrefix, paddingLength: numberPadding },
      );
      return currentValue.toString().padStart(numberPadding, '0');
    } catch (error) {
      this.logger.error('Error generating employee number:', error);
      throw new BadRequestException('Failed to generate employee number');
    }
  }
}
