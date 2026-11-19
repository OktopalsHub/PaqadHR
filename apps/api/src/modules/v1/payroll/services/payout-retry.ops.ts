import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import {
  isPayoutFailedStatus,
  isPayoutPendingStatus,
  isPayoutSuccessStatus,
} from 'src/common/utils/payout-status.util';

import { PayrollItem } from '../entities/payroll-item.entity';
import { buildPayrollMerchantRef } from '../utils/payroll-merchant-ref.util';
import { PayoutApplyOps } from './payout-apply.ops';
import { PayoutLookupOps } from './payout-lookup.ops';

@Injectable()
export class PayoutRetryOps {
  constructor(
    private readonly factory: PaymentProviderFactoryService,
    private readonly apply: PayoutApplyOps,
    private readonly lookup: PayoutLookupOps,
  ) {}

  async reconcileFailedItemBeforeRetry(item: PayrollItem, tenantId: string): Promise<boolean> {
    const provider = this.lookup.resolveStoredProvider(item.paymentProvider);
    if (!provider) {
      throw new BadRequestException(
        `Cannot retry payroll item ${item.id}: its original payment provider is unknown. Contact support to reconcile it.`,
      );
    }
    const retryAttempt = this.lookup.currentMerchantRetryAttempt(item, provider);
    const reference = item.transactionId?.trim();

    const merchantRef = buildPayrollMerchantRef(item.payrollRunId, item.id, retryAttempt);
    // A retry mints a new merchant reference, so anything already submitted under the
    // previous one stays a live payout. Items whose submission outcome we never learned
    // must not be retried blind — that is how an employee gets paid twice.
    if (!reference && item.metadata?.payoutSubmissionPending === true) {
      throw new BadRequestException(
        `Cannot retry payroll item ${item.id}: its payout submission outcome is still unknown. ` +
          'Wait for the provider to confirm the payout before retrying.',
      );
    }
    if (!reference) return true;

    const querier = this.factory.resolvePayoutQuerier(provider);
    let status: string | null = null;
    let amount: number | undefined;

    if (querier) {
      const result = await querier.queryStatus(reference, merchantRef);
      if (result) {
        status = result.status;
        amount = result.amount;
      }
    }

    if (provider === PaymentProvider.NOMBA) {
      const verifiedStatus = status?.trim().toUpperCase();
      if (!verifiedStatus) {
        throw new BadRequestException(
          `Cannot retry payroll item ${item.id}: Nomba could not verify the previous transfer status. Try again after status is available.`,
        );
      }
      const terminalFailureStatuses = new Set(['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED']);
      if (terminalFailureStatuses.has(verifiedStatus)) return true;
      if (isPayoutSuccessStatus(verifiedStatus) || isPayoutPendingStatus(verifiedStatus)) {
        await this.apply.applyTransferStatus(
          merchantRef,
          verifiedStatus,
          reference,
          provider,
          tenantId,
          amount,
        );
        return false;
      }
      throw new BadRequestException(
        `Cannot retry payroll item ${item.id}: Nomba returned non-terminal transfer status "${verifiedStatus}".`,
      );
    }

    if (!status) return true;

    const changed = await this.apply.applyTransferStatus(
      merchantRef,
      status,
      reference,
      provider,
      tenantId,
      amount,
    );
    if (changed) return isPayoutFailedStatus(status);
    return isPayoutFailedStatus(status);
  }
}
