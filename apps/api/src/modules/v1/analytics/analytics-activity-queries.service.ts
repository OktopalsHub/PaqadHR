import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { AttendanceService } from '../attendance/attendance.service';
import { Shoutout } from '../shoutouts/entities/shoutout.entity';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

@Injectable()
export class AnalyticsActivityQueriesService {
  constructor(
    @InjectRepository(TenantMember)
    private readonly memberRepository: Repository<TenantMember>,
    @InjectRepository(Shoutout)
    private readonly shoutoutRepository: Repository<Shoutout>,
    private readonly attendanceService: AttendanceService,
  ) {}

  async getAttendanceSummary(tenantId: string) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const stats = await this.attendanceService.getAttendanceStats(tenantId, startDate, endDate);

    const denominator = stats.totalPresent + stats.totalAbsent + stats.totalLate;
    const attendanceRate =
      denominator > 0 ? Math.round((stats.totalPresent / denominator) * 1000) / 10 : null;

    return {
      attendanceRate,
      present: stats.totalPresent,
      absent: stats.totalAbsent,
      late: stats.totalLate,
      onLeave: stats.totalOnLeave,
      periodDays: 30,
    };
  }

  async getRecognitionSummary(tenantId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const row = await this.shoutoutRepository
      .createQueryBuilder('shoutout')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(shoutout.totalPoints), 0)', 'points')
      .where('shoutout.tenantId = :tenantId', { tenantId })
      .andWhere('shoutout.createdAt >= :startOfMonth', { startOfMonth })
      .getRawOne<{ count: string; points: string }>();

    return {
      shoutoutsThisMonth: Number(row?.count ?? 0),
      pointsAwardedThisMonth: Number(row?.points ?? 0),
    };
  }

  async getHeadcountTrend(tenantId: string) {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const offset = 5 - index;
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    });

    const query = this.memberRepository
      .createQueryBuilder('member')
      .select([])
      .where('member.tenantId = :tenantId', { tenantId });
    months.forEach(({ start, end }, index) => {
      query
        .addSelect(
          `COUNT(*) FILTER (WHERE member.joinDate IS NOT NULL AND member.joinDate <= :end${index} AND (member.leaveDate IS NULL OR member.leaveDate >= :start${index}))`,
          `m${index}`,
        )
        .setParameter(`start${index}`, start)
        .setParameter(`end${index}`, end);
    });
    const row = await query.getRawOne<Record<string, string>>();

    return months.map(({ start }, index) => ({
      label: MONTH_LABELS[start.getMonth()],
      value: Number(row?.[`m${index}`] ?? 0),
    }));
  }
}
