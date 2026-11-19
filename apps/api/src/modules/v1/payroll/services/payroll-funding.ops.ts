import { BadRequestException, Injectable } from '@nestjs/common';

import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { AuditContext } from '../../../../common/interfaces/audit-context.interface';
import { PayrollFundingService } from './payroll-funding.service';
import { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';
import { PayrollRunService } from './payroll-run.service';

@Injectable()
export class PayrollFundingOps {
  constructor(
    private readonly payrollRunService: PayrollRunService,
    private readonly payrollPaymentOrchestrator: PayrollPaymentOrchestrator,
    private readonly payrollFunding: PayrollFundingService,
  ) {}

  async fundAndPayPayroll(payrollRunId: string, tenantId: string, auditContext: AuditContext) {
    const run = await this.payrollRunService.getPayrollRun(payrollRunId, tenantId);
    if (!run) throw new BadRequestException('Payroll run not found');
    const payableCurrencies = new Set(
      (run.items ?? [])
        .filter((item) => item.status !== PayrollItemStatus.CANCELLED)
        .map((item) => item.paymentCurrency?.toUpperCase())
        .filter((currency): currency is string => Boolean(currency)),
    );
    if (
      payableCurrencies.has('NGN') &&
      (payableCurrencies.size !== 1 || run.baseCurrency?.toUpperCase() !== 'NGN')
    ) {
      throw new BadRequestException(
        'NGN payroll uses a separate Nomba checkout. Put NGN employees in an NGN-only payroll run.',
      );
    }
    return this.payrollFunding.fundAndPay(payrollRunId, tenantId, auditContext);
  }

  async preflightPayrollFund(payrollRunId: string, tenantId: string) {
    const [readiness, funding] = await Promise.all([
      this.payrollPaymentOrchestrator.getPayrollReadiness(payrollRunId, tenantId),
      this.payrollFunding.preflight(payrollRunId, tenantId),
    ]);
    return { ...readiness, funding };
  }

  async assertPayrollFunded(payrollRunId: string, tenantId: string) {
    return this.payrollPaymentOrchestrator.getPayrollReadiness(payrollRunId, tenantId);
  }
}
