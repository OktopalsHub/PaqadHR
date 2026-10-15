import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantMemberRole } from 'src/common/enums';
import type { QueryDeepPartialEntity } from 'typeorm';
import { Repository } from 'typeorm';
import {
  TenantMemberChangedEvent,
  TenantMemberCreatedEvent,
} from '../../leave/events/leave.events';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import type { CreateTenantMemberDto } from '../dto/create-tenant-member.dto';
import { TenantMember } from '../entities/tenant-member.entity';
import { TenantCounterRepository } from '../repositories/tenant-counter.repository';
import { TenantMemberRepository } from '../repositories/tenant-members.repository';
import { MemberActivityService } from './member-activity.service';
import { MemberReadService } from './member-read.service';

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

  async removeTenantMember(userId: string, tenantId: string, actorMemberId: string): Promise<void> {
    const member = await this.readService.getTenantMemberProfile(userId, tenantId);
    await this.tenantMemberRepository.update(member.id, {
      isActive: false,
      leaveDate: new Date(),
    });
    this.activityService.emitActivity({
      tenantId,
      actorMemberId,
      action: 'member.removed',
      resourceType: 'member',
      resourceId: member.id,
      description: `Removed ${this.activityService.memberDisplayName(member)} from the workspace`,
    });
    this.eventEmitter.emit('tenant.member.changed', new TenantMemberChangedEvent(tenantId));
  }

  async setTenantMemberStatus(
    userId: string,
    tenantId: string,
    isActive: boolean,
  ): Promise<TenantMember> {
    const member = await this.readService.getTenantMemberProfile(userId, tenantId);
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
    return this.readService.getTenantMember(member.id, tenantId);
  }

  async updateTenantMemberStatus(
    memberId: string,
    tenantId: string,
    isActive: boolean,
    actorMemberId: string,
  ): Promise<TenantMember> {
    const member = await this.readService.getTenantMember(memberId, tenantId);
    const updated = await this.setTenantMemberStatus(member.userId, tenantId, isActive);
    this.activityService.emitActivity({
      tenantId,
      actorMemberId,
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
}
