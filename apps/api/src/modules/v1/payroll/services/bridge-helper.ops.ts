import { BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BridgeApiService } from 'src/common/services/bridge-api.service';
import { Repository } from 'typeorm';

import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PaymentResult } from '../../../../common/interfaces/payment-result.interface';
import { ProviderWebhookEvent } from '../../wallets/entities/provider-webhook-event.entity';
import { WalletOperation } from '../../wallets/entities/wallet-operation.entity';
import { WalletLedgerService } from '../../wallets/services/wallet-ledger.service';
import { PayrollItem } from '../entities/payroll-item.entity';
import { updatePayrollItemScopedIfStatus } from '../repositories/payroll-item-write.util';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { addMoneyAmounts, calculatePayrollPlatformFee } from '../utils/payroll-platform-fee.util';
import { BridgeTransferEvent, WALLET_FACTOR, WALLET_SCALE } from './bridge-payroll-payout.shared';
import { PayrollAttemptHistoryService } from './payroll-attempt-history.service';

export class BridgeHelperOps {
  private readonly logger = new Logger('BridgePayrollPayoutService');

  constructor(
    private readonly bridgeApi: BridgeApiService,
    private readonly ledger: WalletLedgerService,
    @InjectRepository(WalletOperation)
    private readonly operations: Repository<WalletOperation>,
    @InjectRepository(ProviderWebhookEvent)
    private readonly webhookEvents: Repository<ProviderWebhookEvent>,
    private readonly payrollItems: PayrollItemRepository,
    private readonly attemptHistory: PayrollAttemptHistoryService,
  ) {}

  readNetwork(item: PayrollItem): string {
    const value = item.metadata?.cryptoNetwork;
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
  }

  amountString(item: PayrollItem): string | null {
    const value = String(item.paymentAmount ?? '').trim();
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value)) return null;
    return value;
  }

  amountUnits(value: string): bigint {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * WALLET_FACTOR + BigInt(fraction.padEnd(Number(WALLET_SCALE), '0'));
  }

  calculatePlanFee(amount: string, percentage: number): string | null {
    return calculatePayrollPlatformFee(amount, percentage);
  }

  addAmounts(left: string, right: string): string {
    const result = addMoneyAmounts(left, right);
    if (result === null) throw new Error('Payroll amount is not a valid decimal.');
    return result;
  }

  readProviderState(value: unknown): string {
    return typeof value === 'string' ? value.toLowerCase() : 'unknown';
  }

  readProviderReceipt(value: unknown): Record<string, string> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const receipt = value as Record<string, unknown>;
    const fields = [
      'initial_amount',
      'developer_fee',
      'exchange_fee',
      'subtotal_amount',
      'gas_fee',
      'final_amount',
      'exchange_rate',
    ] as const;
    const result: Record<string, string> = {};
    for (const field of fields) {
      const item = receipt[field];
      if (typeof item === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(item)) {
        result[field] = item;
      }
    }
    return Object.keys(result).length ? result : null;
  }

  async getBridgeSellRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{ sellRate: string; updatedAt: string }> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    const bridgeFrom = from === 'USDC' ? 'USD' : from;
    const bridgeTo = to === 'USDC' ? 'USD' : to;
    if (bridgeFrom === bridgeTo) {
      return { sellRate: '1', updatedAt: new Date().toISOString() };
    }
    if (bridgeFrom === 'USD' || bridgeTo === 'USD') {
      const rate = await this.bridgeApi.getExchangeRate(bridgeFrom, bridgeTo);
      return { sellRate: rate.sell_rate, updatedAt: rate.updated_at };
    }
    const [toUsd, fromUsd] = await Promise.all([
      this.bridgeApi.getExchangeRate(bridgeFrom, 'USD'),
      this.bridgeApi.getExchangeRate('USD', bridgeTo),
    ]);
    const sellRate = Number(toUsd.sell_rate) * Number(fromUsd.sell_rate);
    if (!Number.isFinite(sellRate) || sellRate <= 0) {
      throw new BadRequestException('Bridge returned an invalid cross-currency exchange rate.');
    }
    return {
      sellRate: sellRate.toPrecision(15),
      updatedAt:
        Date.parse(toUsd.updated_at) < Date.parse(fromUsd.updated_at)
          ? toUsd.updated_at
          : fromUsd.updated_at,
    };
  }

  async failItem(item: PayrollItem, tenantId: string, message: string): Promise<PaymentResult> {
    await this.payrollItems
      .createQueryBuilder()
      .update(PayrollItem)
      .set({ status: PayrollItemStatus.FAILED, failureReason: message })
      .where('id = :id AND status = :status', { id: item.id, status: item.status })
      .andWhere('payroll_run_id IN (SELECT id FROM payroll_runs WHERE tenant_id = :tenantId)', {
        tenantId,
      })
      .execute();
    return {
      success: false,
      outcome: 'failed',
      error: message,
      provider: 'Bridge',
      rail: 'crypto',
    };
  }

  async transitionPayoutAttemptForOperation(
    operation: WalletOperation,
    status: 'processing' | 'payment_processed' | 'failed' | 'requires_review',
    providerReference?: string,
  ): Promise<void> {
    let merchantReference = operation.idempotencyKey;
    if (operation.kind === 'withdrawal') {
      const parentOperationId = operation.metadata?.parentOperationId;
      if (typeof parentOperationId !== 'string') return;
      const parent = await this.operations.findOne({
        where: { id: parentOperationId, tenantId: operation.tenantId, provider: 'bridge' },
        select: { id: true, idempotencyKey: true },
      });
      if (!parent) return;
      merchantReference = parent.idempotencyKey;
    }
    await this.attemptHistory.transitionPayoutAttempt({
      tenantId: operation.tenantId,
      provider: 'bridge',
      merchantReference,
      status,
      providerReference,
    });
  }

  async releaseReservation(operation: WalletOperation): Promise<void> {
    const reservedId = operation.metadata?.sourceReservedAccountId;
    const availableId = operation.metadata?.sourceAvailableAccountId;
    if (typeof reservedId !== 'string' || typeof availableId !== 'string') return;
    await this.ledger.post({
      kind: 'payroll_reservation_release',
      idempotencyKey: `${operation.idempotencyKey}:release`,
      entries: [
        {
          accountId: reservedId,
          direction: 'debit',
          amount: operation.sourceAmount,
          currency: operation.sourceCurrency,
        },
        {
          accountId: availableId,
          direction: 'credit',
          amount: operation.sourceAmount,
          currency: operation.sourceCurrency,
        },
      ],
    });
  }

  async markBankPayoutForReview(parent: WalletOperation, message: string): Promise<void> {
    if (!parent.payrollItemId) return;
    await updatePayrollItemScopedIfStatus(
      this.payrollItems,
      parent.payrollItemId,
      parent.tenantId,
      PayrollItemStatus.PROCESSING,
      { failureReason: message },
    );
    await this.transitionPayoutAttemptForOperation(
      parent,
      'requires_review',
      parent.providerReference ?? undefined,
    );
    this.logger.warn(
      `Bridge bank payout requires review for payroll item ${parent.payrollItemId}.`,
    );
  }

  async paymentResultAfterTransfer(
    item: PayrollItem,
    transferId: string,
    bankPayout: boolean,
  ): Promise<PaymentResult> {
    const current = bankPayout
      ? await this.payrollItems.findOne({
          where: { id: item.id },
          select: { id: true, status: true, transactionId: true },
        })
      : null;
    const paid = !bankPayout || current?.status === PayrollItemStatus.PAID;
    return {
      success: true,
      outcome: paid ? 'paid' : 'processing',
      transactionId: current?.transactionId ?? transferId,
      reference: current?.transactionId ?? transferId,
      provider: 'Bridge',
      providerStatus: paid ? 'payment_processed' : 'processing',
      rail: bankPayout ? 'bank' : 'crypto',
    };
  }

  async claimEvent(event: BridgeTransferEvent): Promise<boolean> {
    const now = new Date();
    const inserted = await this.webhookEvents
      .createQueryBuilder()
      .insert()
      .into(ProviderWebhookEvent)
      .values({
        provider: 'bridge',
        eventId: event.event_id,
        eventType: event.event_type,
        eventObjectId: event.event_object_id ?? null,
        receivedAt: now,
        processedAt: null,
      })
      .orIgnore()
      .execute();
    if ((inserted.identifiers?.length ?? 0) > 0) return true;
    const claimed = await this.webhookEvents
      .createQueryBuilder()
      .update(ProviderWebhookEvent)
      .set({ receivedAt: now })
      .where(
        'provider = :provider AND event_id = :eventId AND processed_at IS NULL AND received_at <= :cutoff',
        {
          provider: 'bridge',
          eventId: event.event_id,
          cutoff: new Date(now.getTime() - 5 * 60 * 1000),
        },
      )
      .execute();
    return (claimed.affected ?? 0) === 1;
  }

  parseEvent(rawBody: Buffer): BridgeTransferEvent {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('Malformed Bridge webhook payload.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new BadRequestException('Invalid Bridge webhook payload.');
    const value = parsed as Record<string, unknown>;
    if (
      typeof value.event_id !== 'string' ||
      typeof value.event_type !== 'string' ||
      typeof value.event_category !== 'string' ||
      !value.event_object ||
      typeof value.event_object !== 'object' ||
      Array.isArray(value.event_object)
    ) {
      throw new BadRequestException('Bridge webhook is missing required event fields.');
    }
    return {
      event_id: value.event_id,
      event_type: value.event_type,
      event_category: value.event_category,
      event_object_id:
        typeof value.event_object_id === 'string' ? value.event_object_id : undefined,
      event_object: value.event_object as Record<string, unknown>,
    };
  }
}
