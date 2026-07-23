import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CelebrationType } from 'src/common/enums/celebration-type.enum';
import { FileUrlService } from 'src/common/services/file-url.service';
import { type FindOneOptions, MoreThanOrEqual, Repository } from 'typeorm';
import type { CelebrationResponseDto } from '../dto/celebrations-response.dto';
import { TenantMember } from '../entities/tenant-member.entity';

/** Years completed on this calendar year's anniversary date (0 = start year). */
function anniversaryYearsThisCalendarYear(startDate: Date, asOf: Date): number {
  return asOf.getFullYear() - startDate.getFullYear();
}

function celebrationSortKey(rawDate: string | Date, year: number): number {
  const iso = typeof rawDate === 'string' ? rawDate : rawDate.toISOString();
  const parts = iso.slice(0, 10).split('-');
  if (parts.length < 3) return 0;
  return Date.UTC(year, Number(parts[1]) - 1, Number(parts[2]));
}

@Injectable()
export class TenantMemberRepository extends Repository<TenantMember> {
  constructor(
    @InjectRepository(TenantMember)
    private readonly tenantMemberRepository: Repository<TenantMember>,
    private readonly fileUrlService: FileUrlService,
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
  async findAllMembersByTenantId(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: { tenantId },
      relations: [
        'user',
        'positionHistory',
        'positionHistory.position',
        'departmentMemberships',
        'departmentMemberships.department',
        'employments',
      ],
      select: {
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
        user: {
          id: true,
          email: true,
        },
        positionHistory: {
          id: true,
          isCurrent: true,
          position: {
            id: true,
            title: true,
          },
        },
        departmentMemberships: {
          id: true,
          role: true,
          isActive: true,
          department: {
            id: true,
            name: true,
          },
        },
        employments: {
          id: true,
          status: true,
          reportsToId: true,
        },
      },
    });
  }
  async findTenantActiveMembers(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepository.find({
      where: { tenantId, isActive: true },
      relations: [
        'user',
        'positionHistory',
        'positionHistory.position',
        'departmentMemberships',
        'departmentMemberships.department',
        'employments',
      ],
      select: {
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
        user: {
          id: true,
          email: true,
        },
        positionHistory: {
          id: true,
          isCurrent: true,
          position: {
            id: true,
            title: true,
          },
        },
        departmentMemberships: {
          id: true,
          role: true,
          isActive: true,
          department: {
            id: true,
            name: true,
          },
        },
        employments: {
          id: true,
          status: true,
          reportsToId: true,
        },
      },
    });
  }
  async findOne(options: FindOneOptions<TenantMember>): Promise<TenantMember | null> {
    return this.tenantMemberRepository.findOne(options);
  }
  async findByUserAndTenantId(userId: string, tenantId: string): Promise<TenantMember> {
    const tenantMember = await this.tenantMemberRepository.findOne({
      where: { userId, tenantId },
      relations: [
        'user',
        'positionHistory',
        'positionHistory.position',
        'departmentMemberships',
        'departmentMemberships.department',
        'employments',
      ],
    });
    if (!tenantMember) {
      throw new ForbiddenException('You are not a member in this Tenant');
    }
    return tenantMember;
  }
  async findMembershipByUserAndTenant(
    userId: string,
    tenantId: string,
  ): Promise<TenantMember | null> {
    return this.tenantMemberRepository.findOne({
      where: { userId, tenantId },
    });
  }
  async findByTenantAndMemberId(tenantId: string, memberId: string): Promise<TenantMember> {
    const member = await this.tenantMemberRepository.findOne({
      where: { id: memberId, tenantId, isActive: true },
    });
    if (!member) {
      throw new ForbiddenException('Tenant Member not found');
    }
    return member;
  }
  async countUserInTenant(userId: string, tenantId: string): Promise<boolean> {
    const count = await this.tenantMemberRepository.count({
      where: { userId, tenantId },
    });
    return count > 0;
  }
  async countByTenantId(tenantId: string): Promise<number> {
    return this.tenantMemberRepository.count({
      where: { tenantId },
    });
  }
  async findLastByTenantId(tenantId: string): Promise<TenantMember | null> {
    return this.tenantMemberRepository.findOne({
      where: { tenantId },
      order: { employeeNumber: 'DESC' },
    });
  }
  async findNewHires(tenantId: string, months: number = 2): Promise<unknown[]> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    return this.tenantMemberRepository.find({
      where: {
        tenantId,
        isActive: true,
        joinDate: MoreThanOrEqual(cutoffDate),
      },
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
        positionHistory: {
          id: true,
          isCurrent: true,
          position: {
            id: true,
            title: true,
          },
        },
        departmentMemberships: {
          id: true,
          isActive: true,
          department: {
            id: true,
            name: true,
          },
        },
      },
      order: { joinDate: 'DESC' },
    });
  }
  async findUpcomingCelebrations(tenantId: string): Promise<CelebrationResponseDto[]> {
    const now = new Date();
    // JS getMonth() is 0-11; PostgreSQL EXTRACT(MONTH) is 1-12
    const currentMonth = now.getMonth() + 1;
    const months = [currentMonth, (currentMonth % 12) + 1, ((currentMonth + 1) % 12) + 1];
    const birthdayQuery = this.tenantMemberRepository
      .createQueryBuilder('member')
      .leftJoin('member.user', 'user')
      .leftJoin('member.positionHistory', 'ph', 'ph.isCurrent = :isCurrent', {
        isCurrent: true,
      })
      .leftJoin('ph.position', 'position')
      .leftJoin('member.departmentMemberships', 'dm', 'dm.isActive = :isActive', { isActive: true })
      .leftJoin('dm.department', 'department')
      .select([
        'member.id',
        'member.firstName',
        'member.lastName',
        'member.preferredName',
        'member.employeeNumber',
        'member.dateOfBirth',
        'member.avatarKey',
        'member.tenantId',
        'position.title as positionTitle',
        'department.name as departmentName',
      ])
      .where('member.tenantId = :tenantId', { tenantId })
      .andWhere('member.isActive = :isActive', { isActive: true })
      .andWhere('member.dateOfBirth IS NOT NULL')
      .andWhere('EXTRACT(MONTH FROM member.dateOfBirth) IN (:...months)', {
        months,
      });
    const anniversaryQuery = this.tenantMemberRepository
      .createQueryBuilder('member')
      .leftJoin('member.employments', 'employment')
      .leftJoin('member.user', 'user')
      .leftJoin('member.positionHistory', 'ph', 'ph.isCurrent = :isCurrent', {
        isCurrent: true,
      })
      .leftJoin('ph.position', 'position')
      .leftJoin('member.departmentMemberships', 'dm', 'dm.isActive = :isActive', { isActive: true })
      .leftJoin('dm.department', 'department')
      .select([
        'member.id',
        'member.firstName',
        'member.lastName',
        'member.preferredName',
        'member.employeeNumber',
        'employment.startDate as anniversaryDate',
        'member.avatarKey',
        'member.tenantId',
        'position.title as positionTitle',
        'department.name as departmentName',
      ])
      .where('member.tenantId = :tenantId', { tenantId })
      .andWhere('member.isActive = :isActive', { isActive: true })
      .andWhere('employment.status = :status', { status: 'active' })
      .andWhere('employment.startDate IS NOT NULL')
      .andWhere('EXTRACT(MONTH FROM employment.startDate) IN (:...months)', {
        months,
      });
    const [birthdays, anniversaries] = await Promise.all([
      birthdayQuery.getRawMany(),
      anniversaryQuery.getRawMany(),
    ]);
    const celebrations = [
      ...birthdays.map((b) => ({
        id: b.member_id,
        firstName: b.member_first_name,
        lastName: b.member_last_name,
        preferredName: b.member_preferred_name,
        employeeNumber: b.member_employee_number,
        avatarUrl:
          b.member_avatar_key && b.member_tenant_id
            ? this.fileUrlService.getMemberAvatarUrl(b.member_tenant_id, b.member_avatar_key) ||
              undefined
            : undefined,
        positionTitle: b.positiontitle,
        departmentName: b.departmentname,
        type: CelebrationType.BIRTHDAY,
        date: b.member_date_of_birth,
      })),
      ...anniversaries.flatMap((a) => {
        const startDate = new Date(a.anniversarydate);
        if (Number.isNaN(startDate.getTime())) return [];
        const years = anniversaryYearsThisCalendarYear(startDate, now);
        if (years < 1) return [];
        return [
          {
            id: a.member_id,
            firstName: a.member_first_name,
            lastName: a.member_last_name,
            preferredName: a.member_preferred_name,
            employeeNumber: a.member_employee_number,
            avatarUrl:
              a.member_avatar_key && a.member_tenant_id
                ? this.fileUrlService.getMemberAvatarUrl(a.member_tenant_id, a.member_avatar_key) ||
                  undefined
                : undefined,
            positionTitle: a.positiontitle,
            departmentName: a.departmentname,
            type: CelebrationType.ANNIVERSARY,
            date: a.anniversarydate,
            years,
          },
        ];
      }),
    ];
    return celebrations.sort((a, b) => {
      const aKey = celebrationSortKey(a.date, now.getFullYear());
      const bKey = celebrationSortKey(b.date, now.getFullYear());
      return aKey - bKey;
    });
  }

  async findMembersWithBirthdayToday(tenantId: string): Promise<TenantMember[]> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    return this.tenantMemberRepository
      .createQueryBuilder('member')
      .where('member.tenantId = :tenantId', { tenantId })
      .andWhere('member.isActive = :isActive', { isActive: true })
      .andWhere('member.dateOfBirth IS NOT NULL')
      .andWhere('EXTRACT(MONTH FROM member.dateOfBirth) = :month', { month })
      .andWhere('EXTRACT(DAY FROM member.dateOfBirth) = :day', { day })
      .getMany();
  }

  async findMembersWithWorkAnniversaryToday(
    tenantId: string,
  ): Promise<Array<{ member: TenantMember; employmentStartDate: Date }>> {
    const members = await this.tenantMemberRepository.find({
      where: { tenantId, isActive: true },
      relations: ['employments'],
    });
    const now = new Date();

    return members.flatMap((member) => {
      const employment = member.employments?.find(
        (item) => item.status === 'active' && item.startDate,
      );
      if (!employment?.startDate) return [];

      const startDate = new Date(employment.startDate);
      if (startDate.getMonth() !== now.getMonth() || startDate.getDate() !== now.getDate()) {
        return [];
      }

      return [{ member, employmentStartDate: startDate }];
    });
  }
}
