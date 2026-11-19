import { ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';

import { TenantMemberRole } from '../../../../common/enums';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import { ManagerAccessService } from '../../../../common/services/manager-access.service';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { resolvePostApprovalPayrollStatus } from './payout-reconciliation.shared';

export class RunQueryOps {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  isPayrollAdmin(role: string): boolean {
    return role === TenantMemberRole.ADMIN || role === TenantMemberRole.OWNER;
  }

  async getPayrollRun(id: string, tenantId: string): Promise<PayrollRun | null> {
    const run = await this.payrollRunRepository.findOne({
      where: { id, tenantId },
      relations: { items: { employee: true }, createdBy: true, tenant: true },
    });
    if (!run) return null;
    // This path loads items, so derive the same count shape the list query uses.
    const counts: Record<string, number> = {};
    for (const item of run.items ?? []) {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return this.healMisclassifiedApprovedRun(run, counts);
  }

  async getPayrollRuns(tenantId: string, limit = 20, offset = 0) {
    const { data: runs, total } = await this.payrollRunRepository.paginate({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: { createdBy: true, tenant: true },
    });
    return this.withItemCounts(runs, tenantId, total, true);
  }

  /**
   * Heal legacy runs and attach per-status item counts so the list can tell "approved and
   * unpaid" from "already paid / payout in flight".
   *
   * Counts are fetched for healing on both paths (the list queries do not load items), but
   * only exposed to admins. A manager's list spans whole runs that include employees outside
   * their reports, so returning per-status counts there would disclose other employees' pay
   * state. Managers still get correctly healed runs; the UI reads no action without counts.
   */
  private async withItemCounts(
    runs: PayrollRun[],
    tenantId: string,
    total: number,
    includeCounts: boolean,
  ) {
    const rows = await this.payrollItemRepository.countByRunIds(
      runs.map((run) => run.id),
      tenantId,
    );
    const byRun = new Map<string, Record<string, number>>();
    for (const row of rows) {
      const bucket = byRun.get(row.payrollRunId) ?? {};
      bucket[row.status] = (bucket[row.status] ?? 0) + row.count;
      byRun.set(row.payrollRunId, bucket);
    }

    const healed = await Promise.all(
      runs.map((run) => this.healMisclassifiedApprovedRun(run, byRun.get(run.id) ?? {})),
    );

    if (!includeCounts) return { runs: healed, total };
    return {
      runs: healed.map((run) => ({ ...run, itemCounts: byRun.get(run.id) ?? {} })),
      total,
    };
  }

  async getPayrollRunsForRequester(
    tenantId: string,
    limit: number,
    offset: number,
    requesterMemberId: string,
    requesterRole: string,
  ) {
    if (this.isPayrollAdmin(requesterRole)) return this.getPayrollRuns(tenantId, limit, offset);
    const directReports = await this.managerAccessService.getDirectReportIds(
      tenantId,
      requesterMemberId,
    );
    if (directReports.length === 0)
      throw new ForbiddenException('Admin or manager access required');
    const items = await this.payrollItemRepository.find({
      where: { memberId: In(directReports) },
      select: { payrollRunId: true },
    });
    const runIds = [...new Set(items.map((i) => i.payrollRunId))];
    if (runIds.length === 0) return { runs: [], total: 0 };
    const { data: runs, total } = await this.payrollRunRepository.paginate({
      where: { tenantId, id: In(runIds) },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: { createdBy: true, tenant: true },
    });
    return this.withItemCounts(runs, tenantId, total, false);
  }

  async getPayrollRunForRequester(
    id: string,
    tenantId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<PayrollRun | null> {
    const run = await this.getPayrollRun(id, tenantId);
    if (!run) return null;
    if (this.isPayrollAdmin(requesterRole)) return run;
    const directReports = await this.managerAccessService.getDirectReportIds(
      tenantId,
      requesterMemberId,
    );
    if (directReports.length === 0)
      throw new ForbiddenException('Admin or manager access required');
    const teamItems = (run.items ?? []).filter((i) => directReports.includes(i.memberId));
    if (teamItems.length === 0) throw new ForbiddenException('No access to this payroll run');
    run.items = teamItems;
    return run;
  }

  /**
   * Older payout reconciliation set approved runs back to `processing`, which resurfaces Approve.
   * Heal on read using approvedAt + item statuses.
   *
   * Item statuses come from `counts` (the grouped page query), not `run.items`: the list
   * queries deliberately do not load the items relation, and treating an unloaded relation
   * as "no items" would stamp APPROVED on a run whose employees have all been paid.
   */
  private async healMisclassifiedApprovedRun(
    run: PayrollRun,
    counts: Record<string, number>,
  ): Promise<PayrollRun> {
    const approvedAt = run.metadata?.approvedAt;
    if (
      run.status !== PayrollStatus.PROCESSING ||
      typeof approvedAt !== 'string' ||
      approvedAt.length === 0
    ) {
      return run;
    }

    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    if (total === 0) {
      run.status = PayrollStatus.APPROVED;
      return this.payrollRunRepository.save(run);
    }

    const next = resolvePostApprovalPayrollStatus({
      pending: counts[PayrollItemStatus.PENDING] ?? 0,
      processing: counts[PayrollItemStatus.PROCESSING] ?? 0,
      paid: counts[PayrollItemStatus.PAID] ?? 0,
      failed: counts[PayrollItemStatus.FAILED] ?? 0,
      active: total - (counts[PayrollItemStatus.CANCELLED] ?? 0),
    });
    if (next === run.status) return run;
    run.status = next;
    if (next === PayrollStatus.COMPLETED) {
      run.processedAt = run.processedAt ?? new Date();
    }
    return this.payrollRunRepository.save(run);
  }
}
