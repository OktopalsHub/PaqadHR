import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronClaimService } from 'src/common/services/cron-claim.service';
import { runCronJob } from 'src/common/utils/cron-logging.util';

import { isBridgeConfigured } from '../../../../common/config/bridge.config';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import { BridgePayrollPayoutService } from './bridge-payroll-payout.service';
import { PayrollFundingService } from './payroll-funding.service';
import { PayrollPaymentOps } from './payroll-payment.ops';
import { PayrollPayoutService } from './payroll-payout.service';

@Injectable()
export class PayrollPayoutCronService {
  private readonly logger = new Logger(PayrollPayoutCronService.name);

  constructor(
    private readonly payrollPayoutService: PayrollPayoutService,
    private readonly payments: PayrollPaymentOps,
    readonly _payrollFunding: PayrollFundingService,
    private readonly cronClaim: CronClaimService,
    private readonly bridgePayrollPayout: BridgePayrollPayoutService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async requeryStuckPayouts(): Promise<void> {
    if (!isPayrollGatewayEnabled() && !isBridgeConfigured()) {
      return;
    }

    await runCronJob(
      this.logger,
      'payroll-payout-requery',
      async () => {
        return this.cronClaim.runExclusive('payroll-payout-requery', async () => {
          const [legacy, bridge] = await Promise.all([
            this.payrollPayoutService.requeryStuckPayouts(),
            this.bridgePayrollPayout.reconcilePendingTransfers(),
          ]);
          return { legacy, bridge };
        });
      },
      { silentWhenIdle: true },
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processScheduledPayouts(): Promise<void> {
    if (!isBridgeConfigured()) {
      return;
    }

    await runCronJob(
      this.logger,
      'payroll-scheduled-payouts',
      async () => {
        return this.cronClaim.runExclusive('payroll-scheduled-payouts', () =>
          this.payments.processDueScheduledPayouts(),
        );
      },
      { silentWhenIdle: true },
    );
  }
}
