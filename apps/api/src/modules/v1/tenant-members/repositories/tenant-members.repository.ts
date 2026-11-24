import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantMemberRole } from 'src/common/enums';
import { relationsFromPaths } from 'src/common/utils/find-relations.util';
import { type EntityManager, type FindOneOptions, In, MoreThanOrEqual, Repository } from 'typeorm';

import { TenantMember } from '../entities/tenant-member.entity';

const MEMBER_LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  middleName: true,
  preferredName: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
  isActive: true,
  joinDate: true,
  leaveDate: true,
  employeeNumber: true,
  role: true,
  tenantId: true,
  userId: true,
  avatarKey: true,
  user: { id: true, email: true },
  positionHistory: {
    id: true,
    isCurrent: true,
    position: { id: true, title: true, color: true },
  },
  departmentMemberships: {
    id: true,
    role: true,
    isActive: true,
    department: { id: true, name: true, color: true },
  },
  employments: { id: true, status: true, reportsToId: true },
} as const;

const MEMBER_LIST_RELATIONS = [
  'user',
  'positionHistory',
  'positionHistory.position',
  'departmentMemberships',
  'departmentMemberships.department',
  'employments',
] as const;

@Injectable()
export class TenantMemberRepository extends Repository<TenantMember> {
  constructor(
    @InjectRepository(TenantMember)
    private readonly tenantMemberRepository: Repository<TenantMember>,
  ) {
    super(
      tenantMemberRepository.target,
      tenantMemberRepository.manager,
      tenantMemberRepository.queryRunner,
    );
  }

  async findByUserId(userId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: { userId, isActive: true },
      relations: { user: true, positionHistory: { position: true } },
    });
  }

  async findActiveMembershipSummariesByUserId(
    userId: string,
  ): Promise<Pick<TenantMember, 'id' | 'tenantId' | 'role' | 'isActive'>[]> {
    return this.tenantMemberRepository.find({
      where: { userId, isActive: true },
      select: { id: true, tenantId: true, role: true, isActive: true },
    });
  }

  async findAllMembersByTenantId(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: { tenantId },
      relations: relationsFromPaths(MEMBER_LIST_RELATIONS),
      select: { ...MEMBER_LIST_SELECT },
    });
  }

  /** Return active employee and distinct active department counts for a tenant. */
  async getTenantMemberSummary(
    tenantId: string,
  ): Promise<{ activeEmployees: number; departments: number }> {
    const activeEmployees = await this.tenantMemberRepository.count({
      where: { tenantId, isActive: true },
    });

    const result = await this.tenantMemberRepository
      .createQueryBuilder('member')
      .innerJoin(
        'member.departmentMemberships',
        'departmentMembership',
        'departmentMembership.isActive = :departmentActive',
        { departmentActive: true },
      )
      .where('member.tenantId = :tenantId', { tenantId })
      .andWhere('member.isActive = :memberActive', { memberActive: true })
      .select('COUNT(DISTINCT departmentMembership.departmentId)', 'count')
      .getRawOne<{ count: string }>();

    return {
      activeEmployees,
      departments: Number(result?.count ?? 0),
    };
  }

  async findByIdsAndTenantId(tenantId: string, memberIds: string[]): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: { tenantId, id: In(memberIds) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        preferredName: true,
      },
    });
  }

  async findTenantActiveMembers(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: { tenantId, isActive: true },
      relations: relationsFromPaths(MEMBER_LIST_RELATIONS),
      select: { ...MEMBER_LIST_SELECT },
    });
  }

  async findOne(options: FindOneOptions<TenantMember>): Promise<TenantMember | null> {
    return this.tenantMemberRepository.findOne(options);
  }

  async findByUserAndTenantId(userId: string, tenantId: string): Promise<TenantMember> {
    const tenantMember = await this.tenantMemberRepository.findOne({
      where: { userId, tenantId },
      relations: relationsFromPaths(MEMBER_LIST_RELATIONS),
    });
    if (!tenantMember) throw new ForbiddenException('You are not a member in this Tenant');
    return tenantMember;
  }

  async findMembershipByUserAndTenant(
    userId: string,
    tenantId: string,
  ): Promise<TenantMember | null> {
    return this.tenantMemberRepository.findOne({ where: { userId, tenantId } });
  }

  /** Guard lookup: one query with the columns the tenant and member guards read. */
  async findActiveMembershipWithTenantStatus(
    userId: string,
    tenantId: string,
  ): Promise<TenantMember | null> {
    return this.tenantMemberRepository
      .createQueryBuilder('member')
      .innerJoin('member.tenant', 'tenant')
      .select([
        'member.id',
        'member.isActive',
        'member.role',
        'tenant.id',
        'tenant.isActive',
        'tenant.slug',
        'tenant.name',
      ])
      .where('member.userId = :userId AND member.tenantId = :tenantId', {
        userId,
        tenantId,
      })
      .getOne();
  }

  async withTenantLock<T>(
    tenantId: string,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.tenantMemberRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tenantId]);
      return work(manager);
    });
  }

  async findLifecycleTarget(
    memberId: string,
    tenantId: string,
    manager?: EntityManager,
  ): Promise<TenantMember | null> {
    const repository = manager ? manager.getRepository(TenantMember) : this.tenantMemberRepository;
    return repository.findOne({
      where: { id: memberId, tenantId },
      select: {
        id: true,
        userId: true,
        tenantId: true,
        role: true,
        isActive: true,
        leaveDate: true,
        firstName: true,
        lastName: true,
        middleName: true,
        preferredName: true,
      },
    });
  }

  async countActiveOwners(tenantId: string, manager?: EntityManager): Promise<number> {
    const repository = manager ? manager.getRepository(TenantMember) : this.tenantMemberRepository;
    return repository.count({
      where: { tenantId, role: TenantMemberRole.OWNER, isActive: true },
    });
  }

  async findByTenantAndMemberId(tenantId: string, memberId: string): Promise<TenantMember> {
    const member = await this.tenantMemberRepository.findOne({
      where: { id: memberId, tenantId, isActive: true },
    });
    if (!member) throw new ForbiddenException('Tenant Member not found');
    return member;
  }

  async countUserInTenant(userId: string, tenantId: string): Promise<boolean> {
    const count = await this.tenantMemberRepository.count({
      where: { userId, tenantId },
    });
    return count > 0;
  }

  async countByTenantId(tenantId: string): Promise<number> {
    return this.tenantMemberRepository.count({ where: { tenantId } });
  }

  async findLastByTenantId(tenantId: string): Promise<TenantMember | null> {
    return this.tenantMemberRepository.findOne({
      where: { tenantId },
      order: { employeeNumber: 'DESC' },
    });
  }

  async findNewHires(tenantId: string, months = 2): Promise<unknown[]> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    return this.tenantMemberRepository.find({
      where: {
        tenantId,
        isActive: true,
        joinDate: MoreThanOrEqual(cutoffDate),
      },
      relations: {
        positionHistory: { position: true },
        departmentMemberships: { department: true },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        employeeNumber: true,
        joinDate: true,
        avatarKey: true,
        tenantId: true,
        positionHistory: {
          id: true,
          isCurrent: true,
          position: { id: true, title: true },
        },
        departmentMemberships: {
          id: true,
          isActive: true,
          department: { id: true, name: true },
        },
      },
      order: { joinDate: 'DESC' },
    });
  }
}
