import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantMemberRole } from 'src/common/enums';
import type { MemberContext } from 'src/common/interfaces';
import { EncryptionService } from 'src/common/services/encryption.service';
import type { QueryDeepPartialEntity } from 'typeorm';
import { Repository } from 'typeorm';
import { ProfileUpdatedEvent, TenantMemberChangedEvent } from '../../leave/events/leave.events';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import type { UpdateMemberProfileDto } from '../dto/update-member-profile.dto';
import type { UpdateTenantMemberDto } from '../dto/update-tenant-member.dto';
import { TenantMember } from '../entities/tenant-member.entity';
import { TenantMemberRepository } from '../repositories/tenant-members.repository';
import { describeChangedFields, pickChangedFields } from '../utils/member-activity-diff.util';
import { MemberActivityService } from './member-activity.service';
import { MemberOrgAssignmentService } from './member-org-assignment.service';
import { MemberReadService } from './member-read.service';

@Injectable()
export class MemberProfileService {
  constructor(
    private readonly tenantMemberRepository: TenantMemberRepository,
    @InjectRepository(TenantSettings)
    private readonly tenantSettingsRepository: Repository<TenantSettings>,
    private readonly eventEmitter: EventEmitter2,
    private readonly encryptionService: EncryptionService,
    private readonly readService: MemberReadService,
    private readonly activityService: MemberActivityService,
    private readonly orgAssignmentService: MemberOrgAssignmentService,
  ) {}

  async updateTenantMember(
    tenantId: string,
    userId: string,
    updateDto: UpdateMemberProfileDto,
  ): Promise<TenantMember> {
    const member = await this.readService.getTenantMemberProfile(userId, tenantId);
    if (!member) throw new NotFoundException('Tenant member not found');
    await this.assertIdentityUpdateAllowed(tenantId, updateDto, true);
    await this.applyProfileUpdates(member, updateDto);
    return this.readService.getTenantMember(member.id, tenantId);
  }

  async updateTenantMemberProfileById(
    memberId: string,
    tenantId: string,
    updateDto: UpdateMemberProfileDto,
    actorMemberId: string,
  ): Promise<TenantMember> {
    const member = await this.readService.getTenantMember(memberId, tenantId);
    const isSelf = actorMemberId === memberId;
    await this.assertIdentityUpdateAllowed(tenantId, updateDto, isSelf);
    const before = this.activityService.snapshotProfileFields(member);
    await this.applyProfileUpdates(member, updateDto);
    const updated = await this.readService.getTenantMember(memberId, tenantId);
    const after = this.activityService.snapshotProfileFields(updated);
    const { beforeData, afterData } = pickChangedFields(before, after);
    const changedKeys = Object.keys(afterData);
    if (changedKeys.length > 0) {
      const name = this.activityService.memberDisplayName(updated);
      this.activityService.queueMemberActivity({
        tenantId,
        actorMemberId,
        action: 'member.profile_updated',
        resourceId: memberId,
        description: `Updated ${name}'s ${describeChangedFields(changedKeys)}`,
        beforeData,
        afterData,
      });

      if (!isSelf) {
        const updatedBy = this.activityService.memberDisplayName(
          await this.readService.getTenantMember(actorMemberId, tenantId),
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
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only workspace owners and admins can manage employee organization',
      );
    }
    const member = await this.readService.getTenantMember(memberId, tenantId);
    const before = await this.activityService.snapshotOrgFields(member, tenantId);
    await this.applyOrgUpdates(member, tenantId, updateDto);
    const updated = await this.readService.getTenantMember(memberId, tenantId);
    const after = await this.activityService.snapshotOrgFields(updated, tenantId);
    const { beforeData, afterData } = pickChangedFields(before, after);
    const changedKeys = Object.keys(afterData);
    if (changedKeys.length > 0) {
      const name = this.activityService.memberDisplayName(updated);
      this.activityService.queueMemberActivity({
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
    if (Object.keys(updateData).length > 0) {
      await this.tenantMemberRepository.update(
        member.id,
        updateData as QueryDeepPartialEntity<TenantMember>,
      );
    }

    if (updateDto.departmentId !== undefined) {
      await this.orgAssignmentService.updateMemberDepartment(
        tenantId,
        member.id,
        updateDto.departmentId || null,
      );
    }

    if (updateDto.reportsToId !== undefined) {
      await this.orgAssignmentService.updateMemberReportsTo(
        tenantId,
        member.id,
        updateDto.reportsToId || null,
      );
    }

    if (
      updateDto.departmentId !== undefined ||
      updateDto.reportsToId !== undefined ||
      updateDto.role !== undefined
    ) {
      this.eventEmitter.emit('tenant.member.changed', new TenantMemberChangedEvent(tenantId));
    }
  }
}
