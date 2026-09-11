import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FincraApiService } from 'src/common/services/fincra-api.service';
import { NoahApiService } from 'src/common/services/noah-api.service';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { Repository } from 'typeorm';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayoutReconciliation } from './payout-reconciliation';
import { PayoutWebhooks } from './payout-webhooks';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';

@Injectable()
export class PayrollPayoutService {
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
    @Optional() lifecycleNotify?: PayrollLifecycleNotifyService,
  ) {
    this.reconciliation = new PayoutReconciliation(
      fincraApi,
      factory,
      payrollItemRepository,
      payrollRunRepository,
      payrollItemRepo,
      lifecycleNotify,
    );
    this.webhooks = new PayoutWebhooks(
      nombaTransferApi,
      noahApi,
      fincraApi,
      payrollItemRepository,
      payrollRunRepository,
      this.reconciliation,
    );
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
