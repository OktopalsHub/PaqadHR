import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOneOptions, In, MoreThanOrEqual, Repository } from 'typeorm';
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
  positionHistory: { id: true, isCurrent: true, position: { id: true, title: true, color: true } },
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
      relations: ['user', 'positionHistory', 'positionHistory.position'],
    });
  }

  async findActiveMembershipSummariesByUserId(
    userId: string,
  ): Promise<Pick<TenantMember, 'id' | 'tenantId' | 'role' | 'isActive'>[]> {
    return this.tenantMemberRepository.find({
      where: { userId, isActive: true },
      select: ['id', 'tenantId', 'role', 'isActive'],
    });
  }

  async findAllMembersByTenantId(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: { tenantId },
      relations: [...MEMBER_LIST_RELATIONS],
      select: { ...MEMBER_LIST_SELECT },
    });
  }

  async findByIdsAndTenantId(tenantId: string, memberIds: string[]): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: { tenantId, id: In(memberIds) },
      select: { id: true, firstName: true, lastName: true, middleName: true, preferredName: true },
    });
  }

  async findTenantActiveMembers(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: { tenantId, isActive: true },
      relations: [...MEMBER_LIST_RELATIONS],
      select: { ...MEMBER_LIST_SELECT },
    });
  }

  async findOne(options: FindOneOptions<TenantMember>): Promise<TenantMember | null> {
    return this.tenantMemberRepository.findOne(options);
  }

  async findByUserAndTenantId(userId: string, tenantId: string): Promise<TenantMember> {
    const tenantMember = await this.tenantMemberRepository.findOne({
      where: { userId, tenantId },
      relations: [...MEMBER_LIST_RELATIONS],
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

  async findByTenantAndMemberId(tenantId: string, memberId: string): Promise<TenantMember> {
    const member = await this.tenantMemberRepository.findOne({
      where: { id: memberId, tenantId, isActive: true },
    });
    if (!member) throw new ForbiddenException('Tenant Member not found');
    return member;
  }

  async countUserInTenant(userId: string, tenantId: string): Promise<boolean> {
    const count = await this.tenantMemberRepository.count({ where: { userId, tenantId } });
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
      where: { tenantId, isActive: true, joinDate: MoreThanOrEqual(cutoffDate) },
      relations: [
        'positionHistory',
        'positionHistory.position',
        'departmentMemberships',
        'departmentMemberships.department',
      ],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        employeeNumber: true,
        joinDate: true,
        avatarKey: true,
        tenantId: true,
        positionHistory: { id: true, isCurrent: true, position: { id: true, title: true } },
        departmentMemberships: { id: true, isActive: true, department: { id: true, name: true } },
      },
      order: { joinDate: 'DESC' },
    });
  }
}
