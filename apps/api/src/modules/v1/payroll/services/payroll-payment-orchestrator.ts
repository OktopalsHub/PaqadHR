import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { AuditService } from './audit.service';
import { BridgePayrollPayoutService } from './bridge-payroll-payout.service';
import { ManualDisbursementService } from './manual-disbursement.service';
import { MultiPaymentService } from './multi-payment.service';
import { NombaPayrollPayoutService } from './nomba-payroll-payout.service';
import { OrchestratorReadinessOps } from './orchestrator-readiness.ops';
import { OrchestratorRunOps } from './orchestrator-run.ops';
import { PayrollExportService } from './payroll-export.service';
import { PayrollFeeService } from './payroll-fee.service';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';

@Injectable()
export class PayrollPaymentOrchestrator {
  private readonly readiness: OrchestratorReadinessOps;
  private readonly runs: OrchestratorRunOps;

  constructor(
    payrollRunRepository: PayrollRunRepository,
    payrollItemRepository: PayrollItemRepository,
    bridgePayrollPayout: BridgePayrollPayoutService,
    readonly _dataSource: DataSource,
    auditService: AuditService,
    manualDisbursementService: ManualDisbursementService,
    multiPaymentService: MultiPaymentService,
    nombaPayrollPayout: NombaPayrollPayoutService,
    payrollFees: PayrollFeeService,
    payrollExportService: PayrollExportService,
    @Optional() lifecycleNotify?: PayrollLifecycleNotifyService,
  ) {
    this.readiness = new OrchestratorReadinessOps(
      payrollRunRepository,
      payrollItemRepository,
      bridgePayrollPayout,
      auditService,
      nombaPayrollPayout,
      payrollFees,
      lifecycleNotify,
    );
    this.runs = new OrchestratorRunOps(
      payrollRunRepository,
      auditService,
      manualDisbursementService,
      multiPaymentService,
      payrollExportService,
      this.readiness,
      lifecycleNotify,
    );
  }

  getPayrollReadiness(...args: Parameters<OrchestratorReadinessOps['getPayrollReadiness']>) {
    return this.readiness.getPayrollReadiness(...args);
  }

  approvePayroll(...args: Parameters<OrchestratorReadinessOps['approvePayroll']>) {
    return this.readiness.approvePayroll(...args);
  }

  processPayroll(...args: Parameters<OrchestratorRunOps['processPayroll']>) {
    return this.runs.processPayroll(...args);
  }

  payNowPayroll(...args: Parameters<OrchestratorRunOps['payNowPayroll']>) {
    return this.runs.payNowPayroll(...args);
  }

  schedulePayrollPayout(...args: Parameters<OrchestratorRunOps['schedulePayrollPayout']>) {
    return this.runs.schedulePayrollPayout(...args);
  }

  rollbackScheduledPayroll(...args: Parameters<OrchestratorRunOps['rollbackScheduledPayroll']>) {
    return this.runs.rollbackScheduledPayroll(...args);
  }

  processDueScheduledPayouts(
    ...args: Parameters<OrchestratorRunOps['processDueScheduledPayouts']>
  ) {
    return this.runs.processDueScheduledPayouts(...args);
  }

  disburseManualPayroll(...args: Parameters<OrchestratorRunOps['disburseManualPayroll']>) {
    return this.runs.disburseManualPayroll(...args);
  }

  exportBankFile(...args: Parameters<OrchestratorRunOps['exportBankFile']>) {
    return this.runs.exportBankFile(...args);
  }
}
