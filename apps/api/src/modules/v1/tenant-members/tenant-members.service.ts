import { Injectable } from '@nestjs/common';
import type { MemberContext } from 'src/common/interfaces';
import type { ICelebrationResponseDto } from '../../../common/interfaces/icelebration-response-dto.interface';
import type { INewHiresResponseDto } from '../../../common/interfaces/inew-hires-response-dto.interface';
import type { CreateTenantMemberDto } from './dto/create-tenant-member.dto';
import type { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import type { UpdateTenantMemberDto } from './dto/update-tenant-member.dto';
import { TenantMember } from './entities/tenant-member.entity';
import { MemberLifecycleService } from './services/member-lifecycle.service';
import { MemberProfileService } from './services/member-profile.service';
import { MemberReadService } from './services/member-read.service';

@Injectable()
export class TenantMembersService {
  constructor(
    private readonly readService: MemberReadService,
    private readonly lifecycleService: MemberLifecycleService,
    private readonly profileService: MemberProfileService,
  ) {}

  async createTenantMember(
    userId: string,
    tenantId: string,
    createDto: CreateTenantMemberDto,
  ): Promise<TenantMember> {
    return this.lifecycleService.createTenantMember(userId, tenantId, createDto);
  }

  async getTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return this.readService.getTenantMembers(tenantId);
  }

  async listTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return this.readService.listTenantMembers(tenantId);
  }

  async listActiveTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return this.readService.listActiveTenantMembers(tenantId);
  }

  async getTenantMemberId(tenantId: string, memberId: string): Promise<TenantMember> {
    return this.readService.getTenantMemberId(tenantId, memberId);
  }

  async getTenantMembersByIds(tenantId: string, memberIds: string[]): Promise<TenantMember[]> {
    return this.readService.getTenantMembersByIds(tenantId, memberIds);
  }

  async getTenantMembersCount(tenantId: string): Promise<number> {
    return this.readService.getTenantMembersCount(tenantId);
  }

  async getTenantMemberProfile(userId: string, tenantId: string): Promise<TenantMember> {
    return this.readService.getTenantMemberProfile(userId, tenantId);
  }

  async getTenantMember(id: string, tenantId: string): Promise<TenantMember> {
    return this.readService.getTenantMember(id, tenantId);
  }

  async findByEmail(email: string): Promise<TenantMember | null> {
    return this.readService.findByEmail(email);
  }

  async updateTenantMember(
    tenantId: string,
    userId: string,
    updateDto: UpdateMemberProfileDto,
  ): Promise<TenantMember> {
    return this.profileService.updateTenantMember(tenantId, userId, updateDto);
  }

  async updateTenantMemberProfileById(
    memberId: string,
    tenantId: string,
    updateDto: UpdateMemberProfileDto,
    actorMemberId: string,
  ): Promise<TenantMember> {
    return this.profileService.updateTenantMemberProfileById(
      memberId,
      tenantId,
      updateDto,
      actorMemberId,
    );
  }

  async updateTenantMemberById(
    memberId: string,
    tenantId: string,
    updateDto: UpdateTenantMemberDto,
    actor: MemberContext,
  ): Promise<TenantMember> {
    return this.profileService.updateTenantMemberById(memberId, tenantId, updateDto, actor);
  }

  async removeTenantMember(userId: string, tenantId: string, actorMemberId: string): Promise<void> {
    return this.lifecycleService.removeTenantMember(userId, tenantId, actorMemberId);
  }

  async setTenantMemberStatus(
    userId: string,
    tenantId: string,
    isActive: boolean,
  ): Promise<TenantMember> {
    return this.lifecycleService.setTenantMemberStatus(userId, tenantId, isActive);
  }

  async updateTenantMemberStatus(
    memberId: string,
    tenantId: string,
    isActive: boolean,
    actorMemberId: string,
  ): Promise<TenantMember> {
    return this.lifecycleService.updateTenantMemberStatus(
      memberId,
      tenantId,
      isActive,
      actorMemberId,
    );
  }

  async restoreTenantMember(memberId: string): Promise<void> {
    return this.lifecycleService.restoreTenantMember(memberId);
  }

  async checkUserTenantMembership(userId: string, tenantId: string): Promise<TenantMember> {
    return this.readService.checkUserTenantMembership(userId, tenantId);
  }

  async findUserTenantMembership(userId: string, tenantId: string): Promise<TenantMember | null> {
    return this.readService.findUserTenantMembership(userId, tenantId);
  }

  async findTenantMemberUserIds(tenantId: string, userIds: string[]): Promise<Set<string>> {
    return this.readService.findTenantMemberUserIds(tenantId, userIds);
  }

  async memberExistsInTenant(tenantId: string, memberId: string): Promise<boolean> {
    return this.readService.memberExistsInTenant(tenantId, memberId);
  }

  async filterTenantMemberIds(tenantId: string, memberIds: string[]): Promise<Set<string>> {
    return this.readService.filterTenantMemberIds(tenantId, memberIds);
  }

  async isUserInTenant(userId: string, tenantId: string): Promise<boolean> {
    return this.readService.isUserInTenant(userId, tenantId);
  }

  async getUserMemberships(userId: string): Promise<TenantMember[]> {
    return this.readService.getUserMemberships(userId);
  }

  async getActiveMembershipSummaries(
    userId: string,
  ): Promise<Pick<TenantMember, 'id' | 'tenantId' | 'role' | 'isActive'>[]> {
    return this.readService.getActiveMembershipSummaries(userId);
  }

  async getTenantMembersByDepartment(departmentId: string): Promise<TenantMember[]> {
    return this.readService.getTenantMembersByDepartment(departmentId);
  }

  async getTenantOwners(tenantId: string): Promise<TenantMember[]> {
    return this.readService.getTenantOwners(tenantId);
  }

  async listTenantOwners(): Promise<TenantMember[]> {
    return this.readService.listTenantOwners();
  }

  async getNextEmployeeNumber(tenantId: string): Promise<string> {
    return this.lifecycleService.getNextEmployeeNumber(tenantId);
  }

  async getNewHires(tenantId: string, months = 2): Promise<INewHiresResponseDto[]> {
    return this.readService.getNewHires(tenantId, months);
  }

  async getUpcomingCelebrations(tenantId: string): Promise<ICelebrationResponseDto[]> {
    return this.readService.getUpcomingCelebrations(tenantId);
  }

  findMembersWithBirthdayToday(tenantId: string) {
    return this.readService.findMembersWithBirthdayToday(tenantId);
  }

  findMembersWithWorkAnniversaryToday(tenantId: string) {
    return this.readService.findMembersWithWorkAnniversaryToday(tenantId);
  }
}
