import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PayrollRunFundingLedgerEntry } from '../entities/payroll-run-funding-ledger-entry.entity';
import { LedgerDebitOps } from './payroll-ledger-debit.ops';
import { LedgerRecordOps } from './payroll-ledger-record.ops';
import { LedgerReleaseOps } from './payroll-ledger-release.ops';

export type { VerifiedPayrollFundingInput } from './payroll-run-funding-ledger.shared';

/**
 * Public ledger API. The logic lives in the focused collaborators below, which share this
 * repository; keeping one facade means callers and specs construct a single service.
 */
@Injectable()
export class PayrollRunFundingLedgerService {
  private readonly record: LedgerRecordOps;
  private readonly debit: LedgerDebitOps;
  private readonly release: LedgerReleaseOps;

  constructor(
    @InjectRepository(PayrollRunFundingLedgerEntry)
    ledgerRepository: Repository<PayrollRunFundingLedgerEntry>,
  ) {
    this.record = new LedgerRecordOps(ledgerRepository);
    this.debit = new LedgerDebitOps(ledgerRepository);
    this.release = new LedgerReleaseOps(ledgerRepository);
  }

  recordVerifiedFunding(...args: Parameters<LedgerRecordOps['recordVerifiedFunding']>) {
    return this.record.recordVerifiedFunding(...args);
  }

  hasConfirmedPayoutDebit(...args: Parameters<LedgerRecordOps['hasConfirmedPayoutDebit']>) {
    return this.record.hasConfirmedPayoutDebit(...args);
  }

  recordPayoutReversal(...args: Parameters<LedgerRecordOps['recordPayoutReversal']>) {
    return this.record.recordPayoutReversal(...args);
  }

  getRunLedger(...args: Parameters<LedgerRecordOps['getRunLedger']>) {
    return this.record.getRunLedger(...args);
  }

  recordConfirmedPayoutDebit(...args: Parameters<LedgerDebitOps['recordConfirmedPayoutDebit']>) {
    return this.debit.recordConfirmedPayoutDebit(...args);
  }

  reserveFailedPayout(...args: Parameters<LedgerDebitOps['reserveFailedPayout']>) {
    return this.debit.reserveFailedPayout(...args);
  }

  releaseFailedPayoutReservation(
    ...args: Parameters<LedgerReleaseOps['releaseFailedPayoutReservation']>
  ) {
    return this.release.releaseFailedPayoutReservation(...args);
  }

  releaseFailedPayoutReservationsForItem(
    ...args: Parameters<LedgerReleaseOps['releaseFailedPayoutReservationsForItem']>
  ) {
    return this.release.releaseFailedPayoutReservationsForItem(...args);
  }

  releaseUnsubmittedPayoutReservation(
    ...args: Parameters<LedgerReleaseOps['releaseUnsubmittedPayoutReservation']>
  ) {
    return this.release.releaseUnsubmittedPayoutReservation(...args);
  }
}
