import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CandidateStatus, JobStatus, LeaveStatus } from 'src/common/enums';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { In, type Repository } from 'typeorm';

import { DepartmentMember } from '../departments/entities/department-member.entity';
import { Department } from '../departments/entities/department.entity';
import { Leave } from '../leave/entities/leave.entity';
import { PayrollRun } from '../payroll/entities/payroll-run.entity';
import { Candidate } from '../recruitment/entities/candidate.entity';
import { JobOpening } from '../recruitment/entities/job-opening.entity';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Injectable()
export class AnalyticsWorkforceQueriesService {
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
  ) {}

  async getWorkforceSummary(tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [members, departmentCount] = await Promise.all([
      this.memberRepository
        .createQueryBuilder('member')
        .select('COUNT(*)', 'total')
        .addSelect('COUNT(*) FILTER (WHERE member.isActive = true)', 'active')
        .addSelect('COUNT(*) FILTER (WHERE member.joinDate >= :thirtyDaysAgo)', 'recent')
        .where('member.tenantId = :tenantId', { tenantId })
        .setParameter('thirtyDaysAgo', thirtyDaysAgo)
        .getRawOne<{ total: string; active: string; recent: string }>(),
      this.departmentRepository.count({ where: { tenantId } }),
    ]);

    return {
      totalEmployees: Number(members?.total ?? 0),
      activeEmployees: Number(members?.active ?? 0),
      departmentCount,
      newHiresLast30Days: Number(members?.recent ?? 0),
    };
  }

  async getLeaveSummary(tenantId: string) {
    const today = this.toDateKey(new Date());
    const rows = await this.leaveRepository
      .createQueryBuilder('leave')
      .select('leave.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect(
        'COUNT(*) FILTER (WHERE leave.status = :approved AND leave.startDate <= :today AND leave.endDate >= :today)',
        'onLeave',
      )
      .where('leave.tenantId = :tenantId', { tenantId })
      .setParameters({ approved: LeaveStatus.APPROVED, today })
      .groupBy('leave.status')
      .getRawMany<{ status: string; count: string; onLeave: string }>();

    const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    let total = 0;
    let onLeaveNow = 0;
    for (const row of rows) {
      const count = Number(row.count);
      total += count;
      onLeaveNow += Number(row.onLeave);
      if (row.status === LeaveStatus.PENDING) counts.pending = count;
      if (row.status === LeaveStatus.APPROVED) counts.approved = count;
      if (row.status === LeaveStatus.REJECTED) counts.rejected = count;
      if (row.status === LeaveStatus.CANCELLED) counts.cancelled = count;
    }

    const byStatus = [
      { label: 'Pending', value: counts.pending },
      { label: 'Approved', value: counts.approved },
      { label: 'Rejected', value: counts.rejected },
      { label: 'Cancelled', value: counts.cancelled },
    ].filter((item) => item.value > 0);

    return {
      total,
      pending: counts.pending,
      approved: counts.approved,
      rejected: counts.rejected,
      onLeaveNow,
      byStatus,
    };
  }

  async getRecruitmentSummary(tenantId: string) {
    const months = 6;
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const [jobs, statusRows, monthRows] = await Promise.all([
      this.jobRepository
        .createQueryBuilder('job')
        .select('COUNT(*)', 'total')
        .addSelect('COUNT(*) FILTER (WHERE job.status = :active)', 'open')
        .where('job.tenantId = :tenantId', { tenantId })
        .setParameter('active', JobStatus.ACTIVE)
        .getRawOne<{ total: string; open: string }>(),
      this.candidateRepository
        .createQueryBuilder('candidate')
        .select('candidate.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('candidate.tenantId = :tenantId', { tenantId })
        .groupBy('candidate.status')
        .getRawMany<{ status: CandidateStatus; count: string }>(),
      this.candidateRepository
        .createQueryBuilder('candidate')
        .select("to_char(candidate.appliedAt, 'YYYY-MM')", 'month')
        .addSelect('COUNT(*)', 'count')
        .where('candidate.tenantId = :tenantId', { tenantId })
        .andWhere('candidate.appliedAt >= :since', { since })
        .groupBy('month')
        .getRawMany<{ month: string; count: string }>(),
    ]);

    let totalCandidates = 0;
    let hired = 0;
    const pipelineByStatus = statusRows
      .map((row) => {
        const value = Number(row.count);
        totalCandidates += value;
        if (row.status === CandidateStatus.HIRED) hired = value;
        return { label: this.formatCandidateStatus(row.status), value };
      })
      .sort((a, b) => b.value - a.value);

    const countByMonth = new Map(monthRows.map((row) => [row.month, Number(row.count)]));
    const applicationsByMonth: { label: string; value: number }[] = [];
    for (let offset = months - 1; offset >= 0; offset -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      applicationsByMonth.push({
        label: MONTH_LABELS[monthDate.getMonth()],
        value: countByMonth.get(key) ?? 0,
      });
    }

    return {
      totalJobs: Number(jobs?.total ?? 0),
      openRoles: Number(jobs?.open ?? 0),
      totalCandidates,
      hired,
      pipelineByStatus,
      applicationsByMonth,
    };
  }

  async getPayrollSummary(tenantId: string) {
    const settled = [PayrollStatus.COMPLETED, PayrollStatus.APPROVED];
    const lastRunColumns = {
      id: true,
      title: true,
      status: true,
      totalNetAmount: true,
      baseCurrency: true,
      processedAt: true,
      createdAt: true,
    } as const;

    const [totals, lastSettled] = await Promise.all([
      this.payrollRunRepository
        .createQueryBuilder('run')
        .select('COUNT(*)', 'total')
        .addSelect('COUNT(*) FILTER (WHERE run.status IN (:...settled))', 'settled')
        .where('run.tenantId = :tenantId', { tenantId })
        .setParameter('settled', settled)
        .getRawOne<{ total: string; settled: string }>(),
      this.payrollRunRepository.findOne({
        where: { tenantId, status: In(settled) },
        order: { createdAt: 'DESC' },
        select: lastRunColumns,
      }),
    ]);

    const lastCompleted =
      lastSettled ??
      (await this.payrollRunRepository.findOne({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        select: lastRunColumns,
      }));

    return {
      totalRuns: Number(totals?.total ?? 0),
      completedRuns: Number(totals?.settled ?? 0),
      lastRunAmount: lastCompleted ? Number(lastCompleted.totalNetAmount) : null,
      lastRunCurrency: lastCompleted?.baseCurrency ?? null,
      lastRunDate: lastCompleted
        ? (lastCompleted.processedAt ?? lastCompleted.createdAt).toISOString()
        : null,
      lastRunTitle: lastCompleted?.title ?? null,
    };
  }

  async getDepartmentBreakdown(tenantId: string) {
    const departments = await this.departmentRepository.find({
      where: { tenantId },
      select: { id: true, name: true },
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

  private formatCandidateStatus(status: CandidateStatus) {
    return status
      .split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ');
  }

  private toDateKey(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
