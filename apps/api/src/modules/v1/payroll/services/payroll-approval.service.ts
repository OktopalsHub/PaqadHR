import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../audit-logs/services/audit.service';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollStatus, PayrollItemStatus } from '../enums/payroll.enum';
import type { AuditContext } from '../../audit-logs/entities/audit-log.entity';

/**
 * Handles payroll approval and scheduling.
 */
@Injectable()
export class PayrollApprovalService {
  private readonly logger = new Logger(PayrollApprovalService.name);

  constructor(
    @InjectRepository(PayrollRun)
    private readonly payrollRunRepository: Repository<PayrollRun>,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepository: Repository<PayrollItem>,
    private readonly auditService: AuditService,
  ) { }

  async approvePayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items'],
    });
    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }
    if (payrollRun.status !== PayrollStatus.PROCESSING) {
      throw new BadRequestException(
        `Payroll run must be calculated (PROCESSING) before approval. Current status: ${payrollRun.status}`,
      );
    }

    // TODO: Need to inject and use getPayrollReadiness method
    // const readiness = await this.getPayrollReadiness(payrollRunId, tenantId);
    // const notReady = readiness.items.filter(
    //   (item) => !item.ready && !item.issues.includes(PayrollPaymentIssue.EXCLUDED_FROM_RUN),
    // );
    // if (notReady.length > 0) {
    //   throw new BadRequestException(
    //     `${notReady.length} employee(s) are not ready for payout. Remove them from the run or notify them to complete payment settings.`,
    //   );
    // }

    payrollRun.status = PayrollStatus.APPROVED;
    payrollRun.metadata = {
      ...payrollRun.metadata,
      approvedAt: new Date().toISOString(),
      approvedBy: auditContext.performedById,
    };

    // Lock all items
    for (const item of payrollRun.items ?? []) {
      if (item.status === PayrollItemStatus.CANCELLED) continue;
      item.metadata = {
        ...item.metadata,
        lockedAt: new Date().toISOString(),
      };
      await this.payrollItemRepository.save(item);
    }

    await this.payrollRunRepository.save(payrollRun);

    await this.auditService.logPayrollApproved(auditContext, {
      title: payrollRun.title,
      totalNetAmount: payrollRun.totalNetAmount,
      employeeCount: payrollRun.employeeCount,
    });

    return payrollRun;
  }

  async schedulePayout(payrollRunId: string, scheduledDate: Date): Promise<void> {
    const payrollRun = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId },
    });

    if (!payrollRun) {
      throw new BadRequestException('Payroll run not found');
    }

    if (payrollRun.status !== PayrollStatus.APPROVED) {
      throw new BadRequestException('Only approved payroll runs can be scheduled');
    }

    payrollRun.paymentDate = scheduledDate;
    payrollRun.payoutMode = 'SCHEDULED';
    await this.payrollRunRepository.save(payrollRun);
  }
}
