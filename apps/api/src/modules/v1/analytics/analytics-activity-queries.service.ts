import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, type Repository } from 'typeorm';
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

    const shoutouts = await this.shoutoutRepository.find({
      where: {
        tenantId,
        createdAt: MoreThanOrEqual(startOfMonth),
      },
      select: ['id', 'totalPoints'],
    });

    return {
      shoutoutsThisMonth: shoutouts.length,
      pointsAwardedThisMonth: shoutouts.reduce((sum, shoutout) => sum + shoutout.totalPoints, 0),
    };
  }

  async getHeadcountTrend(tenantId: string) {
    const members = await this.memberRepository.find({
      where: { tenantId },
      select: ['joinDate', 'leaveDate', 'isActive'],
    });

    const points: { label: string; value: number }[] = [];
    const now = new Date();

    for (let offset = 5; offset >= 0; offset -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const monthEnd = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      const value = members.filter((member) => {
        if (!member.joinDate) return false;
        const joined = new Date(member.joinDate);
        if (joined > monthEnd) return false;
        if (member.leaveDate) {
          return new Date(member.leaveDate) >= monthDate;
        }
        return member.isActive || joined <= monthEnd;
      }).length;

      points.push({
        label: MONTH_LABELS[monthDate.getMonth()],
        value,
      });
    }

    return points;
  }
}
