import { BadRequestException, Optional } from '@nestjs/common';

import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import {
  PayrollPaymentIssue,
  PayrollPaymentReadiness,
} from '../../../../common/interfaces/payroll-payment-readiness.interface';
import { payrollCalendarDatePart } from '../../../../common/validators/payroll-date.validator';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { isActivePayrollReadinessItem } from '../utils/payroll-readiness-items.util';
import { AuditService } from './audit.service';
import { BridgePayrollPayoutService } from './bridge-payroll-payout.service';
import { NombaPayrollPayoutService } from './nomba-payroll-payout.service';
import { PayrollFeeService } from './payroll-fee.service';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';

export class OrchestratorReadinessOps {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly bridgePayrollPayout: BridgePayrollPayoutService,
    private readonly auditService: AuditService,
    private readonly nombaPayrollPayout: NombaPayrollPayoutService,
    private readonly payrollFees: PayrollFeeService,
    @Optional() private readonly lifecycleNotify?: PayrollLifecycleNotifyService,
  ) {}

  async getPayrollReadiness(payrollRunId: string, tenantId: string) {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: { items: { employee: true }, tenant: true },
    });
    if (!run) throw new BadRequestException('Payroll run not found');

    const items: Array<
      PayrollPaymentReadiness & {
        itemId: string;
        employeeName: string;
        netAmount: number;
        status: PayrollItemStatus;
      }
    > = [];

    const activeItems = (run.items ?? []).filter((item) => isActivePayrollReadinessItem(item));

    const bridgeItems = activeItems.filter((item) => item.paymentCurrency?.toUpperCase() !== 'NGN');
    const nombaItems = activeItems.filter((item) => item.paymentCurrency?.toUpperCase() === 'NGN');
    const [bridgeReadiness, assessedNombaReadiness] = await Promise.all([
      this.bridgePayrollPayout.assessRunReadiness(run, tenantId, bridgeItems),
      this.nombaPayrollPayout.assessRunReadiness(nombaItems, tenantId),
    ]);
    const nombaOnlyRun = run.baseCurrency?.toUpperCase() === 'NGN' && bridgeItems.length === 0;
    const nombaReadiness = nombaOnlyRun
      ? assessedNombaReadiness
      : new Map(
          nombaItems.map((item) => [
            item.id,
            {
              ...assessedNombaReadiness.get(item.id),
              ready: false,
              message:
                'NGN payroll must be in an NGN-only payroll run funded through Nomba checkout.',
            },
          ]),
        );
    const routeReadiness = [
      ...bridgeReadiness,
      ...nombaItems.map((item) => ({
        itemId: item.id,
        ready: nombaReadiness.get(item.id)?.ready ?? false,
        message: nombaReadiness.get(item.id)?.message,
        platformFeeAmount: nombaReadiness.get(item.id)?.platformFeeAmount ?? '0',
        platformFeePercentage: nombaReadiness.get(item.id)?.platformFeePercentage ?? 0,
      })),
    ];
    const readinessByItemId = new Map(routeReadiness.map((entry) => [entry.itemId, entry]));
    for (const item of activeItems) {
      const name = item.employee
        ? `${item.employee.firstName ?? ''} ${item.employee.lastName ?? ''}`.trim()
        : item.memberId;
      const readiness = readinessByItemId.get(item.id);
      const ready = readiness?.ready ?? false;
      items.push({
        memberId: item.memberId,
        ready,
        issues: ready ? [] : [PayrollPaymentIssue.INCOMPLETE_WALLET_DETAILS],
        message: readiness?.message ?? 'Payout route is unavailable.',
        currency: item.paymentCurrency,
        itemId: item.id,
        employeeName: name || 'Unknown',
        netAmount: Number(item.netAmount ?? 0),
        status: item.status,
      });
    }

    const readyCount = items.filter((i) => i.ready).length;
    const feePreview = await this.payrollFees.previewPayrollFees(
      activeItems.map((item) => ({
        amount: Number(item.paymentAmount),
        currency: item.paymentCurrency,
      })),
      tenantId,
    );
    const platformFeeByCurrency: Record<string, number> = {};
    const platformFeePercentage = routeReadiness[0]?.platformFeePercentage ?? 0;
    const activeItemById = new Map(activeItems.map((item) => [item.id, item]));
    for (const entry of routeReadiness) {
      const item = activeItemById.get(entry.itemId);
      const currency = item?.paymentCurrency?.toUpperCase();
      if (!currency) continue;
      platformFeeByCurrency[currency] =
        (platformFeeByCurrency[currency] ?? 0) + Number(entry.platformFeeAmount);
    }
    return {
      payrollRunId,
      currency: run.baseCurrency,
      totalEmployees: items.length,
      readyCount,
      notReadyCount: items.length - readyCount,
      canApprove: items.length > 0 && readyCount === items.length,
      platformFeePercentage,
      platformFeeByCurrency: Object.fromEntries(
        Object.entries(platformFeeByCurrency).map(([currency, amount]) => [
          currency,
          Math.round(amount * 100) / 100,
        ]),
      ),
      payoutFeeReserveByCurrency: feePreview.totalPayoutFeeReserves,
      nombaTransferChargeByCurrency: feePreview.totalNombaTransferCharges,
      totalChargeAmountByCurrency: feePreview.totalChargeAmount,
      providerFeeQuoteAvailable: false,
      providerFeeNote: nombaItems.length
        ? 'The Nomba bank-transfer fee is reserved separately from PaqadHR’s ₦50 per-transfer markup. The indicative Nomba fee is up to ₦50 plus VAT (₦53.75); confirm the exact account tariff before enabling payroll. Nomba checkout card pricing is 1.0–1.4% capped at ₦1,800 for local NGN cards and 3.8% for international cards; checkout processing fees are separate and not included in this payout estimate.'
        : 'Bridge does not provide a locked fee quote for payroll transfers. Provider fees are confirmed on the transfer receipt.',
      items,
    };
  }

  async approvePayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<PayrollRun> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: { items: true },
    });
    if (!run) throw new BadRequestException('Payroll run not found');
    if (run.status !== PayrollStatus.PROCESSING) {
      throw new BadRequestException(`Must be PROCESSING to approve. Current: ${run.status}`);
    }

    const readiness = await this.getPayrollReadiness(payrollRunId, tenantId);
    const notReady = readiness.items.filter((i) => !i.ready);
    if (notReady.length > 0) {
      throw new BadRequestException(
        `${notReady.length} employee(s) not ready. Remove them or notify to complete payment settings.`,
      );
    }

    run.status = PayrollStatus.APPROVED;
    run.metadata = {
      ...run.metadata,
      approvedAt: new Date().toISOString(),
      approvedBy: auditContext.performedById,
    };
    if (run.payoutMode === 'scheduled') {
      run.metadata.scheduledAt = new Date().toISOString();
      run.metadata.scheduledFor = this.toIsoDatePart(run.paymentDate);
    }
    for (const item of run.items ?? []) {
      if (item.status === PayrollItemStatus.CANCELLED) continue;
      item.metadata = { ...item.metadata, lockedAt: new Date().toISOString() };
      await this.payrollItemRepository.save(item);
    }
    await this.payrollRunRepository.save(run);
    await this.auditService.logPayrollApproved(auditContext, {
      title: run.title,
      totalNetAmount: run.totalNetAmount,
      employeeCount: run.employeeCount,
    });
    if (this.lifecycleNotify) {
      await this.lifecycleNotify.onPayrollApproved({
        tenantId,
        run: {
          id: run.id,
          title: run.title,
          tenantId,
          periodStart: run.periodStart,
          periodEnd: run.periodEnd,
          baseCurrency: run.baseCurrency,
        },
        actorMemberId: auditContext.performedById,
      });
      if (run.payoutMode === 'scheduled') {
        await this.lifecycleNotify.onPayrollScheduled({
          tenantId,
          run: {
            id: run.id,
            title: run.title,
            tenantId,
            periodStart: run.periodStart,
            periodEnd: run.periodEnd,
            baseCurrency: run.baseCurrency,
            paymentDate: run.paymentDate,
          },
          paymentDate: this.toIsoDatePart(run.paymentDate),
          auditContext,
        });
      }
    }
    return run;
  }

  toIsoDatePart(value: Date | string): string {
    return payrollCalendarDatePart(value);
  }
}
