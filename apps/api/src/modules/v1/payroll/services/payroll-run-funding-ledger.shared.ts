import { createHash } from 'node:crypto';

import {
  PayrollFundingLedgerEventType,
  type PayrollRunFundingLedgerEntry,
} from '../entities/payroll-run-funding-ledger-entry.entity';

export function reservationReleaseIdempotencyKey(
  reservationKey: string,
  outcome: 'failure' | 'payout',
  provider: string,
  providerReference: string,
): string {
  const fingerprint = createHash('sha256')
    .update(`${reservationKey}:${outcome}:${provider}:${providerReference}`)
    .digest('hex');
  return `reservation-release:${fingerprint}`;
}

export function hasUnreversedConfirmedDebit(
  entries: PayrollRunFundingLedgerEntry[],
  payrollItemId: string | null,
): boolean {
  let net = 0;
  for (const entry of entries) {
    if (entry.payrollItemId !== payrollItemId) continue;
    if (entry.eventType === PayrollFundingLedgerEventType.PAYOUT_CONFIRMED) net += 1;
    else if (entry.eventType === PayrollFundingLedgerEventType.PAYOUT_REVERSED) net -= 1;
  }
  return net > 0;
}

export interface VerifiedPayrollFundingInput {
  tenantId: string;
  payrollRunId: string;
  amount: number;
  currency: string;
  provider: string;
  providerReference: string;
  performedById?: string | null;
  evidence?: Record<string, string | number | boolean | null>;
}
