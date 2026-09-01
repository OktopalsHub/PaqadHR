import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { FincraApiService } from 'src/common/services/fincra-api.service';
import { MonnifyApiService } from 'src/common/services/monnify-api.service';
import { NoahApiService } from 'src/common/services/noah-api.service';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import { paymentProviderLabel } from 'src/common/utils/resolve-payment-provider.util';
import { LessThan, Repository } from 'typeorm';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';

import { buildPayrollMerchantRef } from '../utils/payroll-merchant-ref.util';

const PAYROLL_REF_PATTERN = /^payroll_([0-9a-f-]{36})_([0-9a-f-]{36})(?:_r(\d+))?$/i;
const PAYROLL_AMOUNT_TOLERANCE = 1;

const SUCCESS_STATUSES = new Set([
  'SUCCESS',
  'SUCCESSFUL',
  'COMPLETED',
  'PAYMENT_SUCCESSFUL',
  'SUCCEEDED',
  'PAID',
  'SETTLED',
]);
const PENDING_STATUSES = new Set(['PENDING', 'PENDING_BILLING', 'PROCESSING', 'IN_PROGRESS']);
const FAILED_STATUSES = new Set([
  'FAILED',
  'REFUND',
  'REVERSED',
  'CANCELLED',
  'CANCELED',
  'REJECTED',
]);

@Injectable()
export class PayrollPayoutService {
  private readonly logger = new Logger(PayrollPayoutService.name);

  constructor(
    private readonly nombaTransferApi: NombaTransferApiService,
    private readonly noahApi: NoahApiService,
    private readonly monnifyApi: MonnifyApiService,
    private readonly fincraApi: FincraApiService,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly payrollRunRepository: PayrollRunRepository,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepo: Repository<PayrollItem>,
  ) {}

  async handleNombaWebhook(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim() || !this.nombaTransferApi.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Rejected Nomba payroll webhook: invalid signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    return this.processNombaPayload(payload);
  }

  async handleNoahWebhook(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim() || !this.noahApi.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Rejected Noah payroll webhook: invalid signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    return this.processNoahPayload(payload);
  }

  async processNombaPayload(payload: unknown): Promise<{ received: boolean }> {
    const event = this.nombaTransferApi.parseTransferWebhook(payload);
    if (!event) {
      return { received: true };
    }

    const merchantRef = event.merchantTxRef ?? event.reference;
    const parsed = PAYROLL_REF_PATTERN.exec(merchantRef);
    const tenantId = parsed ? await this.resolveTenantId(parsed[1]) : undefined;
    if (!tenantId) {
      return { received: true };
    }

    const changed = await this.applyTransferStatus(
      merchantRef,
      event.status,
      event.reference,
      PaymentProvider.NOMBA,
      tenantId,
    );
    if (changed && parsed) {
      await this.reconcilePayrollRunStatus(parsed[1], tenantId);
    }
    return { received: true };
  }

  async processNoahPayload(payload: unknown): Promise<{ received: boolean; matched: boolean }> {
    const event = this.noahApi.parseTransferWebhook(payload);
    if (!event) {
      return { received: true, matched: false };
    }

    let merchantRef = event.merchantTxRef ?? event.reference;
    if (!merchantRef || !PAYROLL_REF_PATTERN.test(merchantRef)) {
      if (!event.reference) {
        return { received: true, matched: false };
      }
      const item = await this.payrollItemRepository.findOne({
        where: { transactionId: event.reference },
        relations: ['payrollRun'],
      });
      if (!item) {
        return { received: true, matched: false };
      }
      merchantRef = `payroll_${item.payrollRunId}_${item.id}`;
    }

    const parsed = PAYROLL_REF_PATTERN.exec(merchantRef);
    const tenantId = parsed ? await this.resolveTenantId(parsed[1]) : undefined;
    if (!tenantId) {
      return { received: true, matched: true };
    }

    const changed = await this.applyTransferStatus(
      merchantRef,
      event.status,
      event.reference,
      PaymentProvider.NOAH,
      tenantId,
    );
    if (changed) {
      await this.reconcilePayrollRunStatus(parsed![1], tenantId);
    }
    return { received: true, matched: true };
  }

  async processFincraPayload(payload: unknown): Promise<{ received: boolean; matched: boolean }> {
    const event = this.fincraApi.parsePayoutWebhook(payload);
    if (!event) {
      return { received: true, matched: false };
    }

    const parsed = PAYROLL_REF_PATTERN.exec(event.merchantRef);
    const tenantId = parsed ? await this.resolveTenantId(parsed[1]) : undefined;
    if (!tenantId) {
      return { received: true, matched: false };
    }

    let status = event.status;
    let reference = event.reference;
    let amount = event.amount;

    try {
      const verified = await this.fincraApi.getPayoutStatus(event.merchantRef);
      if (!verified) {
        this.logger.warn(`Fincra payout webhook ignored: no payout found for ${event.merchantRef}`);
        return { received: true, matched: false };
      }
      status = verified.status;
      reference = verified.reference ?? reference;
      amount = verified.amount ?? amount;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Fincra payout webhook verification failed for ${event.merchantRef}: ${message}`,
      );
      return { received: true, matched: false };
    }

    const changed = await this.applyTransferStatus(
      event.merchantRef,
      status,
      reference,
      PaymentProvider.FINCRA,
      tenantId,
      amount,
    );
    if (changed && parsed) {
      await this.reconcilePayrollRunStatus(parsed[1], tenantId);
    }
    return { received: true, matched: changed };
  }

  async processMonnifyPayload(payload: {
    merchantRef: string;
    transactionId: string;
    status: string;
    amount?: number;
  }): Promise<{ received: boolean; matched: boolean }> {
    const parsed = PAYROLL_REF_PATTERN.exec(payload.merchantRef);
    const tenantId = parsed ? await this.resolveTenantId(parsed[1]) : undefined;
    if (!tenantId) {
      return { received: true, matched: false };
    }

    const changed = await this.applyTransferStatus(
      payload.merchantRef,
      payload.status,
      payload.transactionId,
      PaymentProvider.MONNIFY,
      tenantId,
      payload.amount,
    );
    if (changed && parsed) {
      await this.reconcilePayrollRunStatus(parsed[1], tenantId);
    }
    return { received: true, matched: changed };
  }

  async requeryStuckPayouts(): Promise<{ checked: number; updated: number }> {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const stuckItems = await this.payrollItemRepo.find({
      where: {
        status: PayrollItemStatus.PROCESSING,
        updatedAt: LessThan(cutoff),
      },
      take: 50,
    });

    let updated = 0;
    for (const item of stuckItems) {
      const reference = item.transactionId;
      if (!reference) continue;

      const tenantId = item.payrollRun?.tenantId ?? (await this.resolveTenantId(item.payrollRunId));
      if (!tenantId) continue;

      const retryAttempt =
        typeof item.metadata?.payoutRetryCount === 'number' ? item.metadata.payoutRetryCount : 0;
      const merchantRef = buildPayrollMerchantRef(item.payrollRunId, item.id, retryAttempt);
      const provider = this.resolveStoredProvider(item.paymentProvider);
      let status: string | null = null;
      let amount: number | undefined;

      if (provider === PaymentProvider.NOAH) {
        const verified = await this.noahApi.verifyTransaction(reference);
        status = verified?.status?.toUpperCase() ?? null;
        if (verified?.amount != null) {
          amount = Number(verified.amount);
        }
      } else if (provider === PaymentProvider.MONNIFY) {
        const verified = await this.monnifyApi.getDisbursementStatus(reference);
        status = verified.status;
        amount = verified.amount;
      } else if (provider === PaymentProvider.FINCRA) {
        const verified = await this.fincraApi.getPayoutStatus(merchantRef);
        status = verified?.status ?? null;
        amount = verified?.amount;
      } else {
        status = await this.nombaTransferApi.getTransactionStatus(reference);
      }

      if (!status) continue;

      const changed = await this.applyTransferStatus(
        merchantRef,
        status,
        reference,
        provider,
        tenantId,
        amount,
      );
      if (changed) {
        updated += 1;
        await this.reconcilePayrollRunStatus(item.payrollRunId, tenantId);
      }
    }

    return { checked: stuckItems.length, updated };
  }

  /**
   * Before retrying a FAILED item, requery the provider so in-flight payouts are not duplicated.
   * Returns true when a new payout attempt is safe; false when the item was reconciled away from FAILED.
   */
  async reconcileFailedItemBeforeRetry(item: PayrollItem, tenantId: string): Promise<boolean> {
    const merchantRef = buildPayrollMerchantRef(item.payrollRunId, item.id);
    const provider = this.resolveStoredProvider(item.paymentProvider);

    if (provider === PaymentProvider.FINCRA) {
      try {
        const verified = await this.fincraApi.getPayoutStatus(merchantRef);
        if (!verified) {
          return true;
        }

        const status = verified.status.toUpperCase();
        if (SUCCESS_STATUSES.has(status) || PENDING_STATUSES.has(status)) {
          await this.applyTransferStatus(
            merchantRef,
            status,
            verified.reference ?? item.transactionId ?? merchantRef,
            PaymentProvider.FINCRA,
            tenantId,
            verified.amount,
          );
          return false;
        }

        if (FAILED_STATUSES.has(status)) {
          return true;
        }

        return false;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new BadRequestException(
          `Cannot retry payroll item ${item.id}: Fincra status lookup failed (${message})`,
        );
      }
    }

    const reference = item.transactionId?.trim();
    if (!reference) {
      return true;
    }

    let status: string | null = null;
    let amount: number | undefined;
    const providerRef = reference;

    if (provider === PaymentProvider.NOAH) {
      const verified = await this.noahApi.verifyTransaction(reference);
      status = verified?.status?.toUpperCase() ?? null;
      if (verified?.amount != null) {
        amount = Number(verified.amount);
      }
    } else if (provider === PaymentProvider.MONNIFY) {
      const verified = await this.monnifyApi.getDisbursementStatus(reference);
      status = verified.status;
      amount = verified.amount;
    } else {
      status = await this.nombaTransferApi.getTransactionStatus(reference);
    }

    if (!status) {
      return true;
    }

    const changed = await this.applyTransferStatus(
      merchantRef,
      status,
      providerRef,
      provider,
      tenantId,
      amount,
    );
    if (changed) {
      return FAILED_STATUSES.has(status.toUpperCase());
    }
    if (FAILED_STATUSES.has(status.toUpperCase())) {
      return true;
    }
    return false;
  }

  private async resolveTenantId(payrollRunId: string): Promise<string | undefined> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId },
      select: ['tenantId'],
    });
    return run?.tenantId;
  }

  /** Labels are human-readable; match loosely to enum for requery branching. */
  private resolveStoredProvider(stored: string | null | undefined): PaymentProvider {
    const value = (stored ?? '').toLowerCase();
    if (value.includes('fincra')) {
      return PaymentProvider.FINCRA;
    }
    if (value.includes('noah') || value.includes('international') || value.includes('crypto')) {
      return PaymentProvider.NOAH;
    }
    if (value.includes('monnify')) {
      return PaymentProvider.MONNIFY;
    }
    return PaymentProvider.NOMBA;
  }

  async applyTransferStatus(
    merchantRef: string,
    rawStatus: string,
    transactionId: string,
    provider: PaymentProvider = PaymentProvider.NOMBA,
    tenantId?: string,
    amount?: number,
  ): Promise<boolean> {
    const parsed = PAYROLL_REF_PATTERN.exec(merchantRef);
    if (!parsed) {
      return false;
    }

    const [, payrollRunId, itemId] = parsed;
    const where: Record<string, unknown> = { id: itemId, payrollRunId };
    if (tenantId) {
      where.payrollRun = { tenantId };
    }
    const item = await this.payrollItemRepository.findOne({
      where,
      relations: ['payrollRun'],
    });
    if (!item) {
      return false;
    }
    if (tenantId) {
      const runTenantId = item.payrollRun?.tenantId ?? (await this.resolveTenantId(payrollRunId));
      if (runTenantId && runTenantId !== tenantId) {
        return false;
      }
    }

    const status = rawStatus.toUpperCase();
    const providerName = paymentProviderLabel(provider);

    if (SUCCESS_STATUSES.has(status)) {
      if (item.status === PayrollItemStatus.PAID) return false;
      if (
        amount != null &&
        Number.isFinite(amount) &&
        Math.abs(Number(amount) - Number(item.paymentAmount)) > PAYROLL_AMOUNT_TOLERANCE
      ) {
        this.logger.error(
          `Payroll amount mismatch for item ${itemId}: expected ${item.paymentAmount}, got ${amount}; leaving PROCESSING`,
        );
        if (item.status === PayrollItemStatus.PENDING) {
          item.status = PayrollItemStatus.PROCESSING;
          item.transactionId = transactionId;
          item.paymentProvider = providerName;
          await this.payrollItemRepository.save(item);
          return true;
        }
        return false;
      }
      item.status = PayrollItemStatus.PAID;
      item.transactionId = transactionId;
      item.paymentProvider = providerName;
      item.paidAt = new Date();
      item.failureReason = null;
      await this.payrollItemRepository.save(item);
      return true;
    }

    if (FAILED_STATUSES.has(status)) {
      if (item.status === PayrollItemStatus.FAILED) return false;
      if (item.status === PayrollItemStatus.PAID) return false;
      item.status = PayrollItemStatus.FAILED;
      item.transactionId = transactionId;
      item.failureReason = `${providerName} ${status.toLowerCase()}`;
      await this.payrollItemRepository.save(item);
      this.logger.warn(`Payroll item ${itemId} failed: ${status}`);
      return true;
    }

    if (PENDING_STATUSES.has(status) && item.status === PayrollItemStatus.PENDING) {
      item.status = PayrollItemStatus.PROCESSING;
      item.transactionId = transactionId;
      item.paymentProvider = providerName;
      await this.payrollItemRepository.save(item);
      return true;
    }

    if (PENDING_STATUSES.has(status) && item.status === PayrollItemStatus.FAILED) {
      item.status = PayrollItemStatus.PROCESSING;
      item.transactionId = transactionId;
      item.paymentProvider = providerName;
      item.failureReason = null;
      await this.payrollItemRepository.save(item);
      return true;
    }

    return false;
  }

  classifyPaymentResultStatus(rawStatus?: string): 'paid' | 'processing' | 'failed' {
    const status = (rawStatus ?? '').toUpperCase();
    if (SUCCESS_STATUSES.has(status)) return 'paid';
    if (FAILED_STATUSES.has(status)) return 'failed';
    return 'processing';
  }

  async reconcilePayrollRunStatus(payrollRunId: string, tenantId: string): Promise<void> {
    const run = await this.payrollRunRepository.findByIdWithItems(payrollRunId, tenantId);
    if (!run) {
      return;
    }
    const items = run.items;
    if (items.length === 0) {
      return;
    }

    let pending = 0;
    let processing = 0;
    let paid = 0;
    let failed = 0;

    for (const item of items) {
      switch (item.status) {
        case PayrollItemStatus.PENDING:
          pending += 1;
          break;
        case PayrollItemStatus.PROCESSING:
          processing += 1;
          break;
        case PayrollItemStatus.PAID:
          paid += 1;
          break;
        case PayrollItemStatus.FAILED:
          failed += 1;
          break;
        default:
          break;
      }
    }

    const inFlight = pending + processing;

    if (inFlight > 0) {
      run.status = PayrollStatus.PROCESSING;
    } else if (paid === items.length) {
      run.status = PayrollStatus.COMPLETED;
      run.processedAt = run.processedAt ?? new Date();
    } else if (failed === items.length) {
      run.status = PayrollStatus.FAILED;
    } else if (paid > 0 && failed > 0) {
      run.status = PayrollStatus.PROCESSING;
    } else if (paid > 0) {
      run.status = PayrollStatus.COMPLETED;
      run.processedAt = run.processedAt ?? new Date();
    } else {
      run.status = PayrollStatus.FAILED;
    }

    await this.payrollRunRepository.save(run);
  }
}
