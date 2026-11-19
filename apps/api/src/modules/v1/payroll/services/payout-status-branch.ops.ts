import { Injectable, Logger, Optional } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { isPayoutSuccessStatus } from 'src/common/utils/payout-status.util';
import { paymentProviderLabel } from 'src/common/utils/resolve-payment-provider.util';
import { Repository } from 'typeorm';

import { PayrollItem } from '../entities/payroll-item.entity';
import { PayoutLookupOps } from './payout-lookup.ops';
import {
  PAYROLL_AMOUNT_TOLERANCE,
  ParsedMerchantRef,
  TransferOutcome,
} from './payout-reconciliation.shared';
import { PayrollRunFundingLedgerService } from './payroll-run-funding-ledger.service';

@Injectable()
export class PayoutBranchOps {
  private readonly logger = new Logger('PayoutReconciliation');

  constructor(
    private readonly factory: PaymentProviderFactoryService,
    private readonly lookup: PayoutLookupOps,
    @Optional()
    private readonly fundingLedger?: PayrollRunFundingLedgerService,
  ) {}

  async applyCompletedStatus(input: {
    transactionId: string;
    provider: PaymentProvider;
    providerName: string;
    itemId: string;
    amount: number | undefined;
    outcome: TransferOutcome;
    item: PayrollItem;
    repository: Repository<PayrollItem>;
  }): Promise<boolean> {
    const { transactionId, provider, providerName, itemId, amount, outcome, item, repository } =
      input;
    if (item.status === PayrollItemStatus.PAID) {
      // A repeated provider success must not notify or mutate payroll state again.
      // Keep the persisted item available to the ledger-recovery step below, but only
      // when this success belongs to the exact payout already recorded on the item.
      if (
        provider === PaymentProvider.NOMBA &&
        this.lookup.isSameProvider(item.paymentProvider, provider) &&
        item.transactionId === transactionId
      ) {
        outcome.item = item;
        outcome.kind = 'paid';
      }
      return false;
    }
    if (
      item.metadata?.fxAtPayout !== true &&
      amount != null &&
      Number.isFinite(amount) &&
      Math.abs(Number(amount) - Number(item.paymentAmount)) > PAYROLL_AMOUNT_TOLERANCE
    ) {
      this.logger.error(
        `Payroll amount mismatch for item ${itemId}: expected ${item.paymentAmount}, got ${amount}; leaving PROCESSING`,
      );
      if (item.status !== PayrollItemStatus.PENDING) return false;
      item.status = PayrollItemStatus.PROCESSING;
      item.transactionId = transactionId;
      item.paymentProvider = providerName;
      await repository.save(item);
      return true;
    }

    if (item.status !== PayrollItemStatus.PENDING && item.status !== PayrollItemStatus.PROCESSING) {
      return false;
    }
    item.status = PayrollItemStatus.PAID;
    item.transactionId = transactionId;
    item.paymentProvider = providerName;
    item.paidAt = new Date();
    item.failureReason = null;
    await repository.save(item);
    outcome.item = await repository.findOne({
      where: { id: item.id },
      relations: { payrollRun: true, employee: true },
    });
    outcome.kind = 'paid';
    return true;
  }

  async applyReversalStatus(input: {
    status: string;
    provider: PaymentProvider;
    providerName: string;
    itemId: string;
    outcome: TransferOutcome;
    item: PayrollItem;
    repository: Repository<PayrollItem>;
  }): Promise<boolean> {
    const { status, providerName, itemId, outcome, item, repository } = input;
    // The provider took back a payout we recorded as paid. Reopen it as failed so it can
    // be retried; the ledger credit is recorded after this transaction commits.
    item.status = PayrollItemStatus.FAILED;
    item.paidAt = null;
    item.failureReason = `${providerName} ${status.toLowerCase()}`;
    await repository.save(item);
    outcome.item = await repository.findOne({
      where: { id: item.id },
      relations: { payrollRun: true, employee: true },
    });
    outcome.kind = 'failed';
    this.logger.warn(`Payroll item ${itemId} reversed by provider: ${status}`);
    return true;
  }

  async applyFailedStatus(input: {
    status: string;
    transactionId: string;
    providerName: string;
    itemId: string;
    outcome: TransferOutcome;
    item: PayrollItem;
    repository: Repository<PayrollItem>;
  }): Promise<boolean> {
    const { status, transactionId, providerName, itemId, outcome, item, repository } = input;
    if (item.status === PayrollItemStatus.FAILED || item.status === PayrollItemStatus.PAID) {
      return false;
    }
    if (item.status !== PayrollItemStatus.PENDING && item.status !== PayrollItemStatus.PROCESSING) {
      return false;
    }
    item.status = PayrollItemStatus.FAILED;
    item.transactionId = transactionId;
    item.paymentProvider = providerName;
    item.failureReason = `${providerName} ${status.toLowerCase()}`;
    await repository.save(item);
    outcome.item = await repository.findOne({
      where: { id: item.id },
      relations: { payrollRun: true, employee: true },
    });
    outcome.kind = 'failed';
    this.logger.warn(`Payroll item ${itemId} failed: ${status}`);
    return true;
  }

  async applyProcessingStatus(input: {
    transactionId: string;
    providerName: string;
    item: PayrollItem;
    repository: Repository<PayrollItem>;
  }): Promise<boolean> {
    const { transactionId, providerName, item, repository } = input;
    if (item.status !== PayrollItemStatus.PENDING && item.status !== PayrollItemStatus.FAILED) {
      return false;
    }
    item.status = PayrollItemStatus.PROCESSING;
    item.transactionId = transactionId;
    item.paymentProvider = providerName;
    item.failureReason = null;
    await repository.save(item);
    return true;
  }

  async recoverPayoutDebit(input: {
    merchantRef: string;
    status: string;
    transactionId: string;
    provider: PaymentProvider;
    resolvedTenantId: string | undefined;
    payrollRunId: ParsedMerchantRef['payrollRunId'];
    itemId: string;
    amount: number | undefined;
    outcome: TransferOutcome;
    parsed: ParsedMerchantRef;
  }): Promise<void> {
    const {
      merchantRef,
      transactionId,
      provider,
      resolvedTenantId,
      itemId,
      amount,
      outcome,
      parsed,
    } = input;
    const changedKind = outcome.kind;
    // A compact `pi_...` merchant ref does not encode the run id, so resolve it from the item
    // that was just confirmed paid. This keeps run-scoped payout debit recovery reachable.
    const debitPayrollRunId = parsed.payrollRunId ?? outcome.item?.payrollRunId ?? null;

    if (
      changedKind === 'paid' &&
      outcome.item?.status === PayrollItemStatus.PAID &&
      outcome.item.transactionId === transactionId &&
      provider === PaymentProvider.NOMBA &&
      debitPayrollRunId &&
      resolvedTenantId &&
      this.fundingLedger
    ) {
      try {
        // Verify terminal success even for repeated events. This repairs the case where
        // payroll state committed but the separate ledger write failed earlier.
        const querier = this.factory.resolvePayoutQuerier(provider);
        const payout = await querier?.queryStatus(transactionId, merchantRef);
        const verifiedStatus = payout?.status?.trim().toUpperCase();
        const referenceMatches =
          provider === PaymentProvider.NOMBA || payout?.reference === merchantRef;
        const verifiedCurrency =
          provider === PaymentProvider.NOMBA ? 'NGN' : payout?.sourceCurrency;
        const verifiedAmount =
          payout?.sourceDebitedAmount ??
          payout?.amount ??
          (provider === PaymentProvider.NOMBA ? Number(outcome.item.paymentAmount) : undefined);
        if (
          payout &&
          referenceMatches &&
          verifiedStatus &&
          isPayoutSuccessStatus(verifiedStatus) &&
          verifiedAmount != null &&
          Number.isFinite(verifiedAmount) &&
          verifiedAmount > 0 &&
          verifiedCurrency
        ) {
          await this.fundingLedger.recordConfirmedPayoutDebit({
            tenantId: resolvedTenantId,
            payrollRunId: debitPayrollRunId,
            payrollItemId: itemId,
            amount: verifiedAmount,
            currency: verifiedCurrency,
            provider,
            providerReference: transactionId,
            evidence: {
              verifiedStatus,
              merchantReference: merchantRef,
              destinationAmount: amount ?? null,
              sourceDebitedAmount: verifiedAmount,
              sourceCurrency: verifiedCurrency,
            },
          });
        } else {
          this.logger.warn(
            `${paymentProviderLabel(provider)} payout ${transactionId} completed but terminal status or debit amount could not be verified; ledger recovery remains pending`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Could not record verified ${paymentProviderLabel(provider)} debit for payroll item ${itemId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
