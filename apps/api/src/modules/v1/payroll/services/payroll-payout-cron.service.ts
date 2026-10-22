import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import { PayrollService } from './payroll.service';
import { PayrollFloatTopupService } from './payroll-float-topup.service';
import { PayrollPayoutService } from './payroll-payout.service';

@Injectable()
export class PayrollPayoutCronService {
  private readonly logger = new Logger(PayrollPayoutCronService.name);

  constructor(
    private readonly payrollPayoutService: PayrollPayoutService,
    private readonly payrollService: PayrollService,
    private readonly payrollFloatTopupService: PayrollFloatTopupService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async requeryStuckPayouts(): Promise<void> {
    if (!isPayrollGatewayEnabled()) {
      return;
    }

    await runCronJob(
      this.logger,
      'payroll-payout-requery',
      async () => {
        return this.payrollPayoutService.requeryStuckPayouts();
      },
      { silentWhenIdle: true },
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processScheduledPayouts(): Promise<void> {
    if (!isPayrollGatewayEnabled()) {
      return;
    }

    await runCronJob(
      this.logger,
      'payroll-scheduled-payouts',
      async () => {
        return this.payrollService.processDueScheduledPayouts();
      },
      { silentWhenIdle: true },
    );
  }

  /**
   * Release retry funding that was left open past the pending window.
   *
   * An abandoned approval or checkout otherwise blocks every new approval for the run, so the
   * tenant could never fund a payout again. Each candidate is verified with the provider first:
   * a paid checkout is credited instead of released.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireStaleRetryFunding(): Promise<void> {
    if (!isPayrollGatewayEnabled()) {
      return;
    }

    await runCronJob(
      this.logger,
      'payroll-retry-funding-expiry',
      async () => {
        return this.payrollFloatTopupService.expireStaleRetryFunding();
      },
      { silentWhenIdle: true },
    );
  }
}
