import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { FincraApiService } from 'src/common/services/fincra-api.service';
import { NoahApiService } from 'src/common/services/noah-api.service';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { Repository } from 'typeorm';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollWebhookEvent } from '../entities/payroll-webhook-event.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayoutReconciliation } from './payout-reconciliation';
import { PayoutWebhooks } from './payout-webhooks';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';
import { PayrollRunFundingLedgerService } from './payroll-run-funding-ledger.service';

@Injectable()
export class PayrollPayoutService {
  private readonly logger = new Logger(PayrollPayoutService.name);
  private readonly webhooks: PayoutWebhooks;
  private readonly reconciliation: PayoutReconciliation;

  constructor(
    readonly nombaTransferApi: NombaTransferApiService,
    readonly noahApi: NoahApiService,
    readonly fincraApi: FincraApiService,
    readonly factory: PaymentProviderFactoryService,
    readonly payrollItemRepository: PayrollItemRepository,
    readonly payrollRunRepository: PayrollRunRepository,
    @InjectRepository(PayrollItem) readonly payrollItemRepo: Repository<PayrollItem>,
    @InjectRepository(PayrollWebhookEvent)
    readonly webhookEventRepository: Repository<PayrollWebhookEvent>,
    @Optional() lifecycleNotify?: PayrollLifecycleNotifyService,
    @Optional() private readonly fundingLedger?: PayrollRunFundingLedgerService,
  ) {
    this.reconciliation = new PayoutReconciliation(
      fincraApi,
      factory,
      payrollRunRepository,
      payrollItemRepo,
      lifecycleNotify,
      fundingLedger,
    );
    this.webhooks = new PayoutWebhooks(
      nombaTransferApi,
      noahApi,
      fincraApi,
      payrollItemRepository,
      payrollRunRepository,
      this.reconciliation,
      webhookEventRepository,
    );
  }

  async recordConfirmedBachsDebit(input: {
    tenantId: string;
    payrollRunId: string;
    payrollItemId: string;
    transactionId: string;
    merchantReference: string;
    destinationAmount?: number;
  }): Promise<void> {
    if (!this.fundingLedger) return;
    try {
      const querier = this.factory.resolvePayoutQuerier(PaymentProvider.BACHS);
      const payout = await querier?.queryStatus(input.transactionId, input.merchantReference);
      // A successful local response or a stale webhook is not enough to book a debit.
      // Only accept a terminal-success status from the provider's status endpoint.
      const verifiedStatus = payout?.status?.trim().toUpperCase();
      const confirmedStatuses = new Set([
        'SUCCESS',
        'SUCCEEDED',
        'COMPLETED',
        'PAID',
        'SETTLED',
        'ACCEPTED',
      ]);
      if (
        !verifiedStatus ||
        !confirmedStatuses.has(verifiedStatus) ||
        payout?.sourceDebitedAmount == null ||
        !Number.isFinite(payout.sourceDebitedAmount) ||
        payout.sourceDebitedAmount <= 0 ||
        !payout.sourceCurrency
      ) {
        this.logger.warn(
          `Bachs payout debit not recorded for item ${input.payrollItemId}: provider status or source debit evidence is not confirmed`,
        );
        return;
      }
      const ledger = this.fundingLedger;
      if (!ledger) return;
      await ledger.recordConfirmedPayoutDebit({
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        payrollItemId: input.payrollItemId,
        amount: payout.sourceDebitedAmount,
        currency: payout.sourceCurrency,
        provider: PaymentProvider.BACHS,
        providerReference: input.transactionId,
        evidence: {
          verifiedStatus: payout.status,
          merchantReference: input.merchantReference,
          destinationAmount: input.destinationAmount ?? null,
          sourceDebitedAmount: payout.sourceDebitedAmount,
          sourceCurrency: payout.sourceCurrency,
        },
      });
    } catch (error) {
      // Payout status is already confirmed. Keep the ledger incomplete and retry authorization
      // blocked rather than converting a debit-reconciliation failure into a payout failure.
      this.logger.warn(
        `Could not record confirmed Bachs debit for item ${input.payrollItemId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async handleNombaWebhook(rawBody: string, signature: string): Promise<{ received: boolean }> {
    return this.webhooks.handleNombaWebhook(rawBody, signature);
  }

  async handleNoahWebhook(rawBody: string, signature: string): Promise<{ received: boolean }> {
    return this.webhooks.handleNoahWebhook(rawBody, signature);
  }

  async processNombaPayload(payload: unknown): Promise<{ received: boolean }> {
    return this.webhooks.processNombaPayload(payload);
  }

  async processNoahPayload(payload: unknown): Promise<{ received: boolean; matched: boolean }> {
    return this.webhooks.processNoahPayload(payload);
  }

  async processFincraPayload(payload: unknown): Promise<{ received: boolean; matched: boolean }> {
    return this.webhooks.processFincraPayload(payload);
  }

  async processMonnifyPayload(payload: {
    merchantRef: string;
    transactionId: string;
    status: string;
    amount?: number;
  }): Promise<{ received: boolean; matched: boolean }> {
    return this.webhooks.processMonnifyPayload(payload);
  }

  async processBachsPayload(payload: unknown): Promise<{ received: boolean; matched: boolean }> {
    return this.webhooks.processBachsPayload(payload);
  }

  async requeryStuckPayouts(): Promise<{ checked: number; updated: number }> {
    return this.reconciliation.requeryStuckPayouts();
  }

  async reconcileFailedItemBeforeRetry(item: PayrollItem, tenantId: string): Promise<boolean> {
    return this.reconciliation.reconcileFailedItemBeforeRetry(item, tenantId);
  }

  async applyTransferStatus(
    merchantRef: string,
    rawStatus: string,
    transactionId: string,
    provider?: import('src/common/enums/payment-provider.enum').PaymentProvider,
    tenantId?: string,
    amount?: number,
  ) {
    return this.reconciliation.applyTransferStatus(
      merchantRef,
      rawStatus,
      transactionId,
      provider,
      tenantId,
      amount,
    );
  }

  classifyPaymentResultStatus(rawStatus?: string): 'paid' | 'processing' | 'failed' {
    return this.reconciliation.classifyPaymentResultStatus(rawStatus);
  }

  async reconcilePayrollRunStatus(payrollRunId: string, tenantId: string): Promise<void> {
    return this.reconciliation.reconcilePayrollRunStatus(payrollRunId, tenantId);
  }
}
