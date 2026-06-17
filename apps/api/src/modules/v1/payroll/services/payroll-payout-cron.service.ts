import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import { PayrollPayoutService } from './payroll-payout.service';

@Injectable()
export class PayrollPayoutCronService {
  private readonly logger = new Logger(PayrollPayoutCronService.name);

  constructor(private readonly payrollPayoutService: PayrollPayoutService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async requeryStuckPayouts(): Promise<void> {
    if (!isPayrollGatewayEnabled()) {
      return;
    }

    const result = await this.payrollPayoutService.requeryStuckPayouts();
    if (result.checked > 0) {
      this.logger.log(
        `Payroll payout requery: checked ${result.checked}, updated ${result.updated}`,
      );
    }
  }
}
