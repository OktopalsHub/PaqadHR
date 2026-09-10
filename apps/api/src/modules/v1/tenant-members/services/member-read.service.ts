import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantMemberRole } from 'src/common/enums';
import { FileUrlService } from 'src/common/services/file-url.service';
import { In } from 'typeorm';
import type { ICelebrationResponseDto } from '../../../../common/interfaces/icelebration-response-dto.interface';
import type { INewHiresResponseDto } from '../../../../common/interfaces/inew-hires-response-dto.interface';
import { TenantMember } from '../entities/tenant-member.entity';
import { CelebrationRepository } from '../repositories/celebration.repository';
import { TenantMemberRepository } from '../repositories/tenant-members.repository';

@Injectable()
export class MemberReadService {
  constructor(
    private readonly tenantMemberRepository: TenantMemberRepository,
    private readonly celebrationRepository: CelebrationRepository,
    private readonly fileUrlService: FileUrlService,
  ) {}

  async getTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.findAllMembersByTenantId(tenantId);
  }

  async listTenantMembers(tenantId: string): Promise<TenantMember[]> {
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

  async checkUserTenantMembership(userId: string, tenantId: string): Promise<TenantMember> {
    return this.tenantMemberRepository.findByUserAndTenantId(userId, tenantId);
  }

  async getTenantMemberProfile(userId: string, tenantId: string): Promise<TenantMember> {
    return this.checkUserTenantMembership(userId, tenantId);
  }

  async findUserTenantMembership(userId: string, tenantId: string): Promise<TenantMember | null> {
    return this.tenantMemberRepository.findMembershipByUserAndTenant(userId, tenantId);
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

  async getActiveMembershipSummaries(
    userId: string,
  ): Promise<Pick<TenantMember, 'id' | 'tenantId' | 'role' | 'isActive'>[]> {
    return this.tenantMemberRepository.findActiveMembershipSummariesByUserId(userId);
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

  async getNewHires(tenantId: string, months = 2): Promise<INewHiresResponseDto[]> {
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
    return this.celebrationRepository.findUpcomingCelebrations(tenantId);
  }

  findMembersWithBirthdayToday(tenantId: string) {
    return this.celebrationRepository.findMembersWithBirthdayToday(tenantId);
  }

  findMembersWithWorkAnniversaryToday(tenantId: string) {
    return this.celebrationRepository.findMembersWithWorkAnniversaryToday(tenantId);
  }
}
