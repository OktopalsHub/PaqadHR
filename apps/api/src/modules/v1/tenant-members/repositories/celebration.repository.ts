import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CelebrationType } from 'src/common/enums/celebration-type.enum';
import { FileUrlService } from 'src/common/services/file-url.service';
import { Repository } from 'typeorm';
import type { CelebrationResponseDto } from '../dto/celebrations-response.dto';
import { TenantMember } from '../entities/tenant-member.entity';

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
export class CelebrationRepository {
  constructor(
    @InjectRepository(TenantMember)
    private readonly repo: Repository<TenantMember>,
    private readonly fileUrlService: FileUrlService,
  ) {}

  async findUpcomingCelebrations(tenantId: string): Promise<CelebrationResponseDto[]> {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const months = [currentMonth, (currentMonth % 12) + 1, ((currentMonth + 1) % 12) + 1];

    const birthdayQuery = this.repo
      .createQueryBuilder('member')
      .leftJoin('member.user', 'user')
      .leftJoin('member.positionHistory', 'ph', 'ph.isCurrent = :isCurrent', { isCurrent: true })
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
      .andWhere('EXTRACT(MONTH FROM member.dateOfBirth) IN (:...months)', { months });

    const anniversaryQuery = this.repo
      .createQueryBuilder('member')
      .leftJoin('member.employments', 'employment')
      .leftJoin('member.user', 'user')
      .leftJoin('member.positionHistory', 'ph', 'ph.isCurrent = :isCurrent', { isCurrent: true })
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
      .andWhere('EXTRACT(MONTH FROM employment.startDate) IN (:...months)', { months });

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
        avatarUrl: this.resolveAvatarUrl(b.member_tenant_id, b.member_avatar_key),
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
            avatarUrl: this.resolveAvatarUrl(a.member_tenant_id, a.member_avatar_key),
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

    return this.repo
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
    const members = await this.repo.find({
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
      if (startDate.getMonth() !== now.getMonth() || startDate.getDate() !== now.getDate())
        return [];
      return [{ member, employmentStartDate: startDate }];
    });
  }

  private resolveAvatarUrl(tenantId: string, avatarKey?: string): string | undefined {
    if (!avatarKey || !tenantId) return undefined;
    return this.fileUrlService.getMemberAvatarUrl(tenantId, avatarKey) || undefined;
  }
}
