import { Injectable } from '@nestjs/common';

import { PayrollItem } from '../entities/payroll-item.entity';
import { PayoutApplyOps } from './payout-apply.ops';
import { PayoutLookupOps } from './payout-lookup.ops';
import { PayoutRetryOps } from './payout-retry.ops';
import { PayoutStuckOps } from './payout-stuck.ops';
import { PayoutWebhooks } from './payout-webhooks';

@Injectable()
export class PayrollPayoutService {
  constructor(
    private readonly webhooks: PayoutWebhooks,
    private readonly stuck: PayoutStuckOps,
    private readonly retry: PayoutRetryOps,
    private readonly apply: PayoutApplyOps,
    private readonly lookup: PayoutLookupOps,
  ) {}

  async handleNombaWebhook(rawBody: string, signature: string): Promise<{ received: boolean }> {
    return this.webhooks.handleNombaWebhook(rawBody, signature);
  }

  async processNombaPayload(payload: unknown): Promise<{ received: boolean }> {
    return this.webhooks.processNombaPayload(payload);
  }

  async requeryStuckPayouts(): Promise<{ checked: number; updated: number }> {
    return this.stuck.requeryStuckPayouts();
  }

  async reconcileFailedItemBeforeRetry(item: PayrollItem, tenantId: string): Promise<boolean> {
    return this.retry.reconcileFailedItemBeforeRetry(item, tenantId);
  }

  async applyTransferStatus(
    merchantRef: string,
    rawStatus: string,
    transactionId: string,
    provider?: import('src/common/enums/payment-provider.enum').PaymentProvider,
    tenantId?: string,
    amount?: number,
  ) {
    return this.apply.applyTransferStatus(
      merchantRef,
      rawStatus,
      transactionId,
      provider,
      tenantId,
      amount,
    );
  }

  classifyPaymentResultStatus(rawStatus?: string): 'paid' | 'processing' | 'failed' {
    return this.lookup.classifyPaymentResultStatus(rawStatus);
  }

  async reconcilePayrollRunStatus(payrollRunId: string, tenantId: string): Promise<void> {
    return this.lookup.reconcilePayrollRunStatus(payrollRunId, tenantId);
  }
}
