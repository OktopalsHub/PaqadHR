import { createHash } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import { isPayoutSuccessStatus } from 'src/common/utils/payout-status.util';
import type { Repository } from 'typeorm';

import { PayrollWebhookEvent } from '../entities/payroll-webhook-event.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { parsePayrollMerchantRef } from '../utils/payroll-merchant-ref.util';
import { PayoutApplyOps } from './payout-apply.ops';
import { PayoutLookupOps } from './payout-lookup.ops';

@Injectable()
export class PayoutWebhooks {
  private readonly logger = new Logger(PayoutWebhooks.name);
  constructor(
    private readonly nombaTransferApi: NombaTransferApiService,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly apply: PayoutApplyOps,
    private readonly lookup: PayoutLookupOps,
    @InjectRepository(PayrollWebhookEvent)
    private readonly webhookEventRepository: Repository<PayrollWebhookEvent>,
  ) {}

  private async claimWebhookEvent(provider: PaymentProvider, payload: unknown): Promise<boolean> {
    const eventId = this.extractEventId(payload);
    const now = new Date();
    const result = await this.webhookEventRepository
      .createQueryBuilder()
      .insert()
      .into(PayrollWebhookEvent)
      .values({ provider, eventId, receivedAt: now, processedAt: null })
      .orIgnore()
      .execute();

    if ((result.identifiers?.length ?? 0) > 0) return true;

    // Reclaim an abandoned event lease atomically. A read followed by save can let
    // two webhook workers both observe an expired lease and process the same event.
    const leaseCutoff = new Date(now.getTime() - 5 * 60 * 1000);
    const reclaimed = await this.webhookEventRepository
      .createQueryBuilder()
      .update(PayrollWebhookEvent)
      .set({ receivedAt: now })
      .where('"provider" = :provider', { provider })
      .andWhere('"event_id" = :eventId', { eventId })
      .andWhere('"processed_at" IS NULL')
      .andWhere('"received_at" <= :leaseCutoff', { leaseCutoff })
      .execute();

    return (reclaimed.affected ?? 0) === 1;
  }

  private async completeWebhookEvent(provider: PaymentProvider, payload: unknown): Promise<void> {
    const eventId = this.extractEventId(payload);
    await this.webhookEventRepository.update({ provider, eventId }, { processedAt: new Date() });
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
      const candidate = candidates.find(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
      if (candidate) return candidate.trim();
    }
    return createHash('sha256')
      .update(JSON.stringify(payload ?? null))
      .digest('hex');
  }

  private async resolvePayrollContext(merchantRef: string): Promise<{
    tenantId: string;
    payrollRunId: string;
  } | null> {
    const parsed = parsePayrollMerchantRef(merchantRef);
    if (!parsed) return null;
    if (parsed.payrollRunId) {
      const tenantId = await this.lookup.resolveTenantId(parsed.payrollRunId);
      return tenantId ? { tenantId, payrollRunId: parsed.payrollRunId } : null;
    }
    const item = await this.payrollItemRepository.findOne({
      where: { id: parsed.payrollItemId },
      relations: { payrollRun: true },
    });
    if (!item) return null;
    const tenantId =
      item.payrollRun?.tenantId ?? (await this.lookup.resolveTenantId(item.payrollRunId));
    return tenantId ? { tenantId, payrollRunId: item.payrollRunId } : null;
  }

  private async confirmedNombaStatus(
    claimedStatus: string,
    merchantRef: string,
  ): Promise<string | null> {
    if (!isPayoutSuccessStatus(claimedStatus)) return claimedStatus;
    const confirmed = await this.nombaTransferApi.getTransactionStatus(merchantRef);
    if (!confirmed) {
      this.logger.warn(`Nomba did not confirm payout ${merchantRef}; releasing the event for retry`);
      return null;
    }
    return isPayoutSuccessStatus(confirmed) ? claimedStatus : confirmed;
  }

  private async releaseWebhookEvent(provider: PaymentProvider, payload: unknown): Promise<void> {
    await this.webhookEventRepository.delete({ provider, eventId: this.extractEventId(payload) });
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

  async processNombaPayload(payload: unknown): Promise<{ received: boolean }> {
    const event = this.nombaTransferApi.parseTransferWebhook(payload);
    if (!event) return { received: true };
    if (!(await this.claimWebhookEvent(PaymentProvider.NOMBA, payload))) {
      return { received: true };
    }

    const merchantRef = event.merchantTxRef ?? event.reference;
    const context = await this.resolvePayrollContext(merchantRef);
    if (!context) return { received: true };

    const status = await this.confirmedNombaStatus(event.status, merchantRef);
    if (!status) {
      await this.releaseWebhookEvent(PaymentProvider.NOMBA, payload);
      throw new ServiceUnavailableException('Could not confirm Nomba payout status');
    }

    const changed = await this.apply.applyTransferStatus(
      merchantRef,
      status,
      event.reference,
      PaymentProvider.NOMBA,
      context.tenantId,
    );
    if (changed) {
      await this.lookup.reconcilePayrollRunStatus(context.payrollRunId, context.tenantId);
    }
    await this.completeWebhookEvent(PaymentProvider.NOMBA, payload);
    return { received: true };
  }
}
