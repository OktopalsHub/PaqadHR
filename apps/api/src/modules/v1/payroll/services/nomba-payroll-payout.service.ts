import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EncryptionService } from 'src/common/services/encryption.service';
import { NombaTransfersService } from 'src/common/services/nomba-transfers.service';
import { Repository } from 'typeorm';

import { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { NombaPayOneOps } from './nomba-pay-one.ops';
import { NombaRunOps } from './nomba-run.ops';
import { PayrollAttemptHistoryService } from './payroll-attempt-history.service';
import { PayrollFeeService } from './payroll-fee.service';
import { PayrollPayoutService } from './payroll-payout.service';

@Injectable()
export class NombaPayrollPayoutService {
  private readonly payOne: NombaPayOneOps;
  private readonly run: NombaRunOps;

  constructor(
    transfers: NombaTransfersService,
    payrollPayouts: PayrollPayoutService,
    payrollFees: PayrollFeeService,
    payrollItems: PayrollItemRepository,
    encryption: EncryptionService,
    @InjectRepository(PaymentMethod)
    paymentMethods: Repository<PaymentMethod>,
    attemptHistory: PayrollAttemptHistoryService,
  ) {
    this.payOne = new NombaPayOneOps(
      transfers,
      payrollPayouts,
      payrollItems,
      encryption,
      attemptHistory,
    );
    this.run = new NombaRunOps(payrollFees, paymentMethods, this.payOne);
  }

  assessRunReadiness(...args: Parameters<NombaRunOps['assessRunReadiness']>) {
    return this.run.assessRunReadiness(...args);
  }

  processRun(...args: Parameters<NombaRunOps['processRun']>) {
    return this.run.processRun(...args);
  }
}
