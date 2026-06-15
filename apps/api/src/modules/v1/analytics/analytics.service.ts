import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CandidateStatus, JobStatus, LeaveStatus } from 'src/common/enums';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { MoreThanOrEqual, type Repository } from 'typeorm';
import { AttendanceService } from '../attendance/attendance.service';
import { Department } from '../departments/entities/department.entity';
import { DepartmentMember } from '../departments/entities/department-member.entity';
import { Leave } from '../leave/entities/leave.entity';
import { PayrollRun } from '../payroll/entities/payroll-run.entity';
import { Candidate } from '../recruitment/entities/candidate.entity';
import { JobOpening } from '../recruitment/entities/job-opening.entity';
import { Shoutout } from '../shoutouts/entities/shoutout.entity';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import type { AnalyticsOverviewDto } from './dto/analytics-overview.dto';

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
export class AnalyticsService {
  constructor(
    @InjectRepository(TenantMember)
    private readonly memberRepository: Repository<TenantMember>,
    @InjectRepository(Leave)
    private readonly leaveRepository: Repository<Leave>,
    @InjectRepository(JobOpening)
    private readonly jobRepository: Repository<JobOpening>,
    @InjectRepository(Candidate)
    private readonly candidateRepository: Repository<Candidate>,
    @InjectRepository(PayrollRun)
    private readonly payrollRunRepository: Repository<PayrollRun>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(DepartmentMember)
    private readonly departmentMemberRepository: Repository<DepartmentMember>,
    @InjectRepository(Shoutout)
    private readonly shoutoutRepository: Repository<Shoutout>,
    private readonly attendanceService: AttendanceService,
  ) {}

  async getOverview(tenantId: string): Promise<AnalyticsOverviewDto> {
    const [
      workforce,
      leaves,
      recruitment,
      payroll,
      attendance,
      recognition,
      departments,
      headcountTrend,
    ] = await Promise.all([
      this.getWorkforceSummary(tenantId),
      this.getLeaveSummary(tenantId),
      this.getRecruitmentSummary(tenantId),
      this.getPayrollSummary(tenantId),
      this.getAttendanceSummary(tenantId),
      this.getRecognitionSummary(tenantId),
      this.getDepartmentBreakdown(tenantId),
      this.getHeadcountTrend(tenantId),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      workforce,
      leaves,
      recruitment,
      payroll,
      attendance,
      recognition,
      departments,
      headcountTrend,
    };
  }

  private async getWorkforceSummary(tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalEmployees, activeEmployees, departmentCount, newHiresLast30Days] =
      await Promise.all([
        this.memberRepository.count({ where: { tenantId } }),
        this.memberRepository.count({ where: { tenantId, isActive: true } }),
        this.departmentRepository.count({ where: { tenantId } }),
        this.memberRepository.count({
          where: {
            tenantId,
            joinDate: MoreThanOrEqual(thirtyDaysAgo),
          },
        }),
      ]);

    return {
      totalEmployees,
      activeEmployees,
      departmentCount,
      newHiresLast30Days,
    };
  }

  private async getLeaveSummary(tenantId: string) {
    const leaves = await this.leaveRepository.find({
      where: { tenantId },
      select: ['id', 'status', 'startDate', 'endDate'],
    });

    const today = this.startOfDay(new Date());
    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    };

    let onLeaveNow = 0;

    for (const leave of leaves) {
      const status = leave.status as LeaveStatus;
      if (status === LeaveStatus.PENDING) counts.pending += 1;
      if (status === LeaveStatus.APPROVED) counts.approved += 1;
      if (status === LeaveStatus.REJECTED) counts.rejected += 1;
      if (status === LeaveStatus.CANCELLED) counts.cancelled += 1;

      if (status === LeaveStatus.APPROVED) {
        const start = this.startOfDay(new Date(leave.startDate));
        const end = this.startOfDay(new Date(leave.endDate));
        if (today >= start && today <= end) {
          onLeaveNow += 1;
        }
      }
    }

    const byStatus = [
      { label: 'Pending', value: counts.pending },
      { label: 'Approved', value: counts.approved },
      { label: 'Rejected', value: counts.rejected },
      { label: 'Cancelled', value: counts.cancelled },
    ].filter((item) => item.value > 0);

    return {
      total: leaves.length,
      pending: counts.pending,
      approved: counts.approved,
      rejected: counts.rejected,
      onLeaveNow,
      byStatus,
    };
  }

  private async getRecruitmentSummary(tenantId: string) {
    const [jobs, candidates] = await Promise.all([
      this.jobRepository.find({
        where: { tenantId },
        select: ['id', 'status'],
      }),
      this.candidateRepository.find({
        where: { tenantId },
        select: ['id', 'status', 'appliedAt'],
      }),
    ]);

    const openRoles = jobs.filter((job) => job.status === JobStatus.ACTIVE).length;
    const hired = candidates.filter(
      (candidate) => candidate.status === CandidateStatus.HIRED,
    ).length;

    const pipelineMap = new Map<string, number>();
    for (const candidate of candidates) {
      const label = this.formatCandidateStatus(candidate.status);
      pipelineMap.set(label, (pipelineMap.get(label) ?? 0) + 1);
    }

    const pipelineByStatus = [...pipelineMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const applicationsByMonth = this.buildMonthlyTrend(
      candidates.map((candidate) => new Date(candidate.appliedAt)),
      6,
    );

    return {
      totalJobs: jobs.length,
      openRoles,
      totalCandidates: candidates.length,
      hired,
      pipelineByStatus,
      applicationsByMonth,
    };
  }

  private async getPayrollSummary(tenantId: string) {
    const runs = await this.payrollRunRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'title',
        'status',
        'totalNetAmount',
        'baseCurrency',
        'processedAt',
        'createdAt',
      ],
    });

    const completedRuns = runs.filter(
      (run) => run.status === PayrollStatus.COMPLETED || run.status === PayrollStatus.APPROVED,
    ).length;

    const lastCompleted =
      runs.find(
        (run) => run.status === PayrollStatus.COMPLETED || run.status === PayrollStatus.APPROVED,
      ) ?? runs[0];

    return {
      totalRuns: runs.length,
      completedRuns,
      lastRunAmount: lastCompleted ? Number(lastCompleted.totalNetAmount) : null,
      lastRunCurrency: lastCompleted?.baseCurrency ?? null,
      lastRunDate: lastCompleted
        ? (lastCompleted.processedAt ?? lastCompleted.createdAt).toISOString()
        : null,
      lastRunTitle: lastCompleted?.title ?? null,
    };
  }

  private async getAttendanceSummary(tenantId: string) {
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

  private async getRecognitionSummary(tenantId: string) {
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

  private async getDepartmentBreakdown(tenantId: string) {
    const departments = await this.departmentRepository.find({
      where: { tenantId },
      select: ['id', 'name'],
      order: { name: 'ASC' },
    });

    const counts = await this.departmentMemberRepository
      .createQueryBuilder('member')
      .innerJoin('member.department', 'department')
      .select('member.departmentId', 'departmentId')
      .addSelect('COUNT(*)', 'count')
      .where('department.tenantId = :tenantId', { tenantId })
      .andWhere('member.isActive = true')
      .groupBy('member.departmentId')
      .getRawMany<{ departmentId: string; count: string }>();

    const countByDepartment = new Map(
      counts.map((row) => [row.departmentId, parseInt(row.count, 10)]),
    );

    return departments
      .map((department) => ({
        id: department.id,
        name: department.name,
        memberCount: countByDepartment.get(department.id) ?? 0,
      }))
      .sort((a, b) => b.memberCount - a.memberCount);
  }

  private async getHeadcountTrend(tenantId: string) {
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

  private buildMonthlyTrend(dates: Date[], months: number) {
    const points: { label: string; value: number }[] = [];
    const now = new Date();

    for (let offset = months - 1; offset >= 0; offset -= 1) {
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

      const value = dates.filter((date) => date >= monthDate && date <= monthEnd).length;

      points.push({
        label: MONTH_LABELS[monthDate.getMonth()],
        value,
      });
    }

    return points;
  }

  private formatCandidateStatus(status: CandidateStatus) {
    return status
      .split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ');
  }

  private startOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }
}
