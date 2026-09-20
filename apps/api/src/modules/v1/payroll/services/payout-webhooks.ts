import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { parseBachsPayoutWebhook } from 'src/common/config/bachs-payout.util';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { FincraApiService } from 'src/common/services/fincra-api.service';
import { NoahApiService } from 'src/common/services/noah-api.service';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import type { Repository } from 'typeorm';
import { PayrollWebhookEvent } from '../entities/payroll-webhook-event.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayoutReconciliation } from './payout-reconciliation';

@Injectable()
export class PayoutWebhooks {
  private readonly logger = new Logger(PayoutWebhooks.name);
  constructor(
    private readonly nombaTransferApi: NombaTransferApiService,
    private readonly noahApi: NoahApiService,
    private readonly fincraApi: FincraApiService,
    private readonly payrollItemRepository: PayrollItemRepository,
    readonly _payrollRunRepository: PayrollRunRepository,
    private readonly reconciliation: PayoutReconciliation,
    private readonly webhookEventRepository: Repository<PayrollWebhookEvent>,
  ) {}

  private async claimWebhookEvent(provider: PaymentProvider, payload: unknown): Promise<boolean> {
    const eventId = this.extractEventId(payload);
    const result = await this.webhookEventRepository
      .createQueryBuilder()
      .insert()
      .into(PayrollWebhookEvent)
      .values({ provider, eventId })
      .orIgnore()
      .execute();
    return (result.identifiers?.length ?? 0) > 0;
  }

  private extractEventId(payload: unknown): string {
    if (payload && typeof payload === 'object') {
      const value = payload as Record<string, unknown>;
      const candidates = [
        value.eventId,
        value.eventID,
        value.id,
        value.event_id,
        typeof value.data === 'object' && value.data !== null
          ? (value.data as Record<string, unknown>).eventId
          : undefined,
        typeof value.data === 'object' && value.data !== null
          ? (value.data as Record<string, unknown>).id
          : undefined,
      ];
      const candidate = candidates.find((item): item is string => typeof item === 'string' && item.trim());
      if (candidate) return candidate.trim();
    }
    return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');
  }

  private async resolvePayrollContext(merchantRef: string): Promise<{
    tenantId: string;
    payrollRunId: string;
  } | null> {
    const parsed = parsePayrollMerchantRef(merchantRef);
    if (!parsed) return null;
    if (parsed.payrollRunId) {
      const tenantId = await this.reconciliation.resolveTenantId(parsed.payrollRunId);
      return tenantId ? { tenantId, payrollRunId: parsed.payrollRunId } : null;
    }
    const item = await this.payrollItemRepository.findOne({
      where: { id: parsed.payrollItemId },
      relations: ['payrollRun'],
    });
    if (!item) return null;
    const tenantId =
      item.payrollRun?.tenantId ?? (await this.reconciliation.resolveTenantId(item.payrollRunId));
    return tenantId ? { tenantId, payrollRunId: item.payrollRunId } : null;
  }

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
    if (!event) return { received: true };
    if (!(await this.claimWebhookEvent(PaymentProvider.NOMBA, payload))) return { received: true };

    const merchantRef = event.merchantTxRef ?? event.reference;
    const context = await this.resolvePayrollContext(merchantRef);
    if (!context) return { received: true };

    const changed = await this.reconciliation.applyTransferStatus(
      merchantRef,
      event.status,
      event.reference,
      PaymentProvider.NOMBA,
      context.tenantId,
    );
    if (changed) {
      await this.reconciliation.reconcilePayrollRunStatus(context.payrollRunId, context.tenantId);
    }
    return { received: true };
  }

  async processNoahPayload(payload: unknown): Promise<{ received: boolean; matched: boolean }> {
    const event = this.noahApi.parseTransferWebhook(payload);
    if (!event) return { received: true, matched: false };
    if (!(await this.claimWebhookEvent(PaymentProvider.NOAH, payload))) return { received: true, matched: false };

    let merchantRef = event.merchantTxRef ?? event.reference;
    if (!merchantRef || !isPayrollMerchantRef(merchantRef)) {
      if (!event.reference) return { received: true, matched: false };
      const item = await this.payrollItemRepository.findOne({
        where: { transactionId: event.reference },
        relations: ['payrollRun'],
      });
      if (!item) return { received: true, matched: false };
      merchantRef = buildPayrollMerchantRef(item.payrollRunId, item.id);
    }

    const context = await this.resolvePayrollContext(merchantRef);
    if (!context) return { received: true, matched: true };

    const changed = await this.reconciliation.applyTransferStatus(
      merchantRef,
      event.status,
      event.reference,
      PaymentProvider.NOAH,
      context.tenantId,
    );
    if (changed) {
      await this.reconciliation.reconcilePayrollRunStatus(context.payrollRunId, context.tenantId);
    }
    return { received: true, matched: true };
  }

  async processFincraPayload(payload: unknown): Promise<{ received: boolean; matched: boolean }> {
    const event = this.fincraApi.parsePayoutWebhook(payload);
    if (!event) return { received: true, matched: false };
    if (!(await this.claimWebhookEvent(PaymentProvider.FINCRA, payload))) return { received: true, matched: false };

    const context = await this.resolvePayrollContext(event.merchantRef);
    if (!context) return { received: true, matched: false };

    let reference = event.reference;
    let amount = event.amount;
    let status: string;

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

    const changed = await this.reconciliation.applyTransferStatus(
      event.merchantRef,
      status,
      reference,
      PaymentProvider.FINCRA,
      context.tenantId,
      amount,
    );
    if (changed) {
      await this.reconciliation.reconcilePayrollRunStatus(context.payrollRunId, context.tenantId);
    }
    return { received: true, matched: changed };
  }

  async processMonnifyPayload(payload: {
    merchantRef: string;
    transactionId: string;
    status: string;
    amount?: number;
  }): Promise<{ received: boolean; matched: boolean }> {
    if (!(await this.claimWebhookEvent(PaymentProvider.MONNIFY, payload))) return { received: true, matched: false };
    const context = await this.resolvePayrollContext(payload.merchantRef);
    if (!context) return { received: true, matched: false };

    const changed = await this.reconciliation.applyTransferStatus(
      payload.merchantRef,
      payload.status,
      payload.transactionId,
      PaymentProvider.MONNIFY,
      context.tenantId,
      payload.amount,
    );
    if (changed) {
      await this.reconciliation.reconcilePayrollRunStatus(context.payrollRunId, context.tenantId);
    }
    return { received: true, matched: changed };
  }

  async processBachsPayload(payload: unknown): Promise<{ received: boolean; matched: boolean }> {
    const event = parseBachsPayoutWebhook(payload);
    if (!event) return { received: true, matched: false };
    if (!(await this.claimWebhookEvent(PaymentProvider.BACHS, payload))) return { received: true, matched: false };

    // data.reference is the reference Paqad set at payout creation (the payroll merchant ref).
    let merchantRef = event.reference;
    if (!merchantRef || !isPayrollMerchantRef(merchantRef)) {
      if (!event.withdrawalId) return { received: true, matched: false };
      const item = await this.payrollItemRepository.findOne({
        where: { transactionId: event.withdrawalId },
        relations: ['payrollRun'],
      });
      if (!item) return { received: true, matched: false };
      merchantRef = buildPayrollMerchantRef(item.payrollRunId, item.id);
    }

    const context = await this.resolvePayrollContext(merchantRef);
    if (!context) return { received: true, matched: false };

    // Prefer the delivered amount in the destination currency — that is the same
    // basis as PayrollItem.paymentAmount (data.amount is in the source balance currency).
    const amount = event.toAmount ?? event.amount;
    const changed = await this.reconciliation.applyTransferStatus(
      merchantRef,
      event.status,
      event.withdrawalId,
      PaymentProvider.BACHS,
      context.tenantId,
      amount,
    );
    if (changed) {
      await this.reconciliation.reconcilePayrollRunStatus(context.payrollRunId, context.tenantId);
    }
    return { received: true, matched: changed };
  }
}
