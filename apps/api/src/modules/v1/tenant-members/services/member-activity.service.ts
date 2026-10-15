import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmploymentStatus } from 'src/common/enums';
import { formatMemberDisplayName } from 'src/common/utils/member-display.util';
import { ACTIVITY_QUEUE_EVENT } from '../../activities/activity.events';
import type { CreateActivityPayload } from '../../activities/interfaces/create-activity-payload.interface';
import { TenantMember } from '../entities/tenant-member.entity';
import { TenantMemberRepository } from '../repositories/tenant-members.repository';

@Injectable()
export class MemberActivityService {
  constructor(
    private readonly tenantMemberRepository: TenantMemberRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  memberDisplayName(
    member: Pick<TenantMember, 'firstName' | 'lastName' | 'middleName' | 'preferredName'> | null,
  ): string {
    return formatMemberDisplayName(member) ?? 'Member';
  }

  activeDepartmentName(member: TenantMember): string {
    const membership = member.departmentMemberships?.find((dm) => dm.isActive);
    return membership?.department?.name?.trim() || 'None';
  }

  activeReportsToId(member: TenantMember): string | null {
    const employment = member.employments?.find((e) => e.status === EmploymentStatus.ACTIVE);
    return employment?.reportsToId ?? null;
  }

  async resolveMemberLabel(memberId: string | null, tenantId: string): Promise<string> {
    if (!memberId) return 'None';
    const manager = await this.tenantMemberRepository.findOne({
      where: { id: memberId, tenantId },
      select: ['id', 'firstName', 'lastName', 'middleName', 'preferredName'],
    });
    return this.memberDisplayName(manager);
  }

  async snapshotOrgFields(member: TenantMember, tenantId: string): Promise<Record<string, string>> {
    return {
      role: member.role,
      department: this.activeDepartmentName(member),
      reportsTo: await this.resolveMemberLabel(this.activeReportsToId(member), tenantId),
    };
  }

  snapshotProfileFields(member: TenantMember): Record<string, string> {
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

  emitActivity(payload: CreateActivityPayload): void {
    this.eventEmitter.emit(ACTIVITY_QUEUE_EVENT, payload);
  }

  queueMemberActivity(payload: {
    tenantId: string;
    actorMemberId: string;
    action: string;
    resourceId: string;
    description: string;
    beforeData: Record<string, string>;
    afterData: Record<string, string>;
  }): void {
    this.emitActivity({
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
    });
  }
}
