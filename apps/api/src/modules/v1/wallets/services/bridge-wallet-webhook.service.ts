import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { verifyBridgeWebhookSignature } from '../../../../common/config/bridge-webhook.util';
import { PaymentProvider } from '../../../../common/enums/payment-provider.enum';
import { ProviderCustomer } from '../entities/provider-customer.entity';
import { ProviderVirtualAccount } from '../entities/provider-virtual-account.entity';
import { ProviderWebhookEvent } from '../entities/provider-webhook-event.entity';
import { WalletFunding } from '../entities/wallet-funding.entity';
import { WalletLedgerService } from './wallet-ledger.service';

type BridgeWebhookEnvelope = {
  event_id: string;
  event_type: string;
  event_category: string;
  event_object_id?: string;
  event_object: Record<string, unknown>;
};

const FUNDING_EVENT_RANK: Record<string, number> = {
  funds_received: 10,
  in_review: 20,
  payment_submitted: 30,
  payment_processed: 40,
  refund_in_flight: 50,
  refunded: 60,
  refund_failed: 60,
};

@Injectable()
export class BridgeWalletWebhookService {
  private readonly logger = new Logger(BridgeWalletWebhookService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ledger: WalletLedgerService,
    @InjectRepository(ProviderWebhookEvent)
    private readonly webhookEventRepository: Repository<ProviderWebhookEvent>,
    @InjectRepository(ProviderVirtualAccount)
    private readonly virtualAccountRepository: Repository<ProviderVirtualAccount>,
    @InjectRepository(ProviderCustomer)
    private readonly customerRepository: Repository<ProviderCustomer>,
  ) {}

  async dispatch(rawBody: Buffer, signature: string | undefined): Promise<{ received: boolean }> {
    if (!verifyBridgeWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Bridge webhook signature.');
    }
    const event = this.parseEnvelope(rawBody);
    const claimed = await this.claimEvent(event);
    if (!claimed) return { received: true };

    try {
      if (event.event_category === 'virtual_account.activity') {
        await this.processVirtualAccountEvent(event);
      }
      await this.webhookEventRepository.update(
        { provider: PaymentProvider.BRIDGE, eventId: event.event_id },
        { processedAt: new Date() },
      );
      return { received: true };
    } catch (error) {
      // Keep the event unprocessed so Bridge's retry can safely resume it.
      await this.webhookEventRepository
        .createQueryBuilder()
        .update(ProviderWebhookEvent)
        .set({ receivedAt: new Date(Date.now() - 6 * 60 * 1000) })
        .where('provider = :provider', { provider: PaymentProvider.BRIDGE })
        .andWhere('event_id = :eventId', { eventId: event.event_id })
        .andWhere('processed_at IS NULL')
        .execute();
      this.logger.warn(
        `Bridge webhook ${event.event_id} processing failed: ${error instanceof Error ? error.name : 'unknown error'}`,
      );
      throw error;
    }
  }

  private parseEnvelope(rawBody: Buffer): BridgeWebhookEnvelope {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('Malformed Bridge webhook payload.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestException('Invalid Bridge webhook payload.');
    }
    const value = parsed as Record<string, unknown>;
    if (
      typeof value.event_id !== 'string' ||
      !value.event_id.trim() ||
      value.event_id.length > 255 ||
      typeof value.event_category !== 'string' ||
      value.event_category.length > 100 ||
      typeof value.event_type !== 'string' ||
      value.event_type.length > 100 ||
      !value.event_object ||
      typeof value.event_object !== 'object' ||
      Array.isArray(value.event_object)
    ) {
      throw new BadRequestException('Bridge webhook is missing required event fields.');
    }
    return {
      event_id: value.event_id.trim(),
      event_type: value.event_type,
      event_category: value.event_category,
      event_object_id:
        typeof value.event_object_id === 'string' ? value.event_object_id.slice(0, 255) : undefined,
      event_object: value.event_object as Record<string, unknown>,
    };
  }

  private async claimEvent(event: BridgeWebhookEnvelope): Promise<boolean> {
    const now = new Date();
    const insert = await this.webhookEventRepository
      .createQueryBuilder()
      .insert()
      .into(ProviderWebhookEvent)
      .values({
        provider: PaymentProvider.BRIDGE,
        eventId: event.event_id,
        eventType: event.event_type,
        eventObjectId: event.event_object_id ?? null,
        receivedAt: now,
        processedAt: null,
      })
      .orIgnore()
      .execute();
    if ((insert.identifiers?.length ?? 0) > 0) return true;

    const existing = await this.webhookEventRepository.findOne({
      where: { provider: PaymentProvider.BRIDGE, eventId: event.event_id },
      select: { id: true, receivedAt: true, processedAt: true },
    });
    if (!existing || existing.processedAt) return false;
    const reclaimed = await this.webhookEventRepository
      .createQueryBuilder()
      .update(ProviderWebhookEvent)
      .set({ receivedAt: now })
      .where('provider = :provider', { provider: PaymentProvider.BRIDGE })
      .andWhere('event_id = :eventId', { eventId: event.event_id })
      .andWhere('processed_at IS NULL')
      .andWhere('received_at <= :cutoff', { cutoff: new Date(now.getTime() - 5 * 60 * 1000) })
      .execute();
    return (reclaimed.affected ?? 0) === 1;
  }

  private async processVirtualAccountEvent(event: BridgeWebhookEnvelope): Promise<void> {
    const value = event.event_object;
    const status = typeof value.type === 'string' ? value.type : '';
    if (!(status in FUNDING_EVENT_RANK)) return;
    const providerVirtualAccountId = value.virtual_account_id;
    const providerCustomerId = value.customer_id;
    const depositId = value.deposit_id;
    const occurredAt =
      typeof value.created_at === 'string' ? new Date(value.created_at) : new Date(Number.NaN);
    if (
      typeof providerVirtualAccountId !== 'string' ||
      typeof providerCustomerId !== 'string' ||
      typeof depositId !== 'string' ||
      !depositId ||
      !Number.isFinite(occurredAt.getTime())
    ) {
      throw new BadRequestException('Bridge virtual account event is incomplete.');
    }

    const virtualAccount = await this.virtualAccountRepository.findOne({
      where: { provider: PaymentProvider.BRIDGE, providerVirtualAccountId },
      select: {
        id: true,
        ownerType: true,
        tenantId: true,
        userId: true,
        providerCustomerId: true,
        sourceCurrency: true,
        destinationCurrency: true,
        network: true,
      },
    });
    if (!virtualAccount) return;
    const customer = await this.customerRepository.findOne({
      where: { id: virtualAccount.providerCustomerId, provider: PaymentProvider.BRIDGE },
      select: { providerCustomerId: true },
    });
    if (!customer?.providerCustomerId || customer.providerCustomerId !== providerCustomerId) {
      throw new UnauthorizedException('Bridge virtual account customer did not match.');
    }

    const amount = typeof value.amount === 'string' ? value.amount : null;
    if (status === 'payment_processed' && (!amount || !this.isPositiveAmount(amount))) {
      throw new BadRequestException('Bridge completed funding event has an invalid amount.');
    }
    const sourceAmount =
      status === 'funds_received' && amount && this.isPositiveAmount(amount) ? amount : null;

    const shouldEnsureAccounts = status === 'payment_processed';
    const availableAccount = shouldEnsureAccounts
      ? await this.ledger.ensureAccount({
          ownerType: virtualAccount.ownerType,
          tenantId: virtualAccount.tenantId,
          userId: virtualAccount.userId,
          accountType: 'available',
          currency: virtualAccount.destinationCurrency,
          network: virtualAccount.network,
        })
      : null;
    const custodyAccount = shouldEnsureAccounts
      ? await this.ledger.ensureAccount({
          ownerType: 'system',
          accountType: 'custody',
          currency: virtualAccount.destinationCurrency,
          network: virtualAccount.network,
          normalSide: 'debit',
        })
      : null;

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WalletFunding);
      let funding = await repository
        .createQueryBuilder('funding')
        .setLock('pessimistic_write')
        .where('funding.provider = :provider', { provider: PaymentProvider.BRIDGE })
        .andWhere('funding.virtual_account_id = :virtualAccountId', {
          virtualAccountId: virtualAccount.id,
        })
        .andWhere('funding.provider_deposit_id = :depositId', { depositId })
        .getOne();
      if (!funding) {
        funding = repository.create({
          ownerType: virtualAccount.ownerType,
          tenantId: virtualAccount.tenantId,
          userId: virtualAccount.userId,
          virtualAccountId: virtualAccount.id,
          provider: PaymentProvider.BRIDGE,
          providerDepositId: depositId,
          status,
          sourceAmount,
          sourceCurrency: virtualAccount.sourceCurrency,
          destinationAmount: status === 'payment_processed' ? amount : null,
          destinationCurrency: virtualAccount.destinationCurrency,
          network: virtualAccount.network,
          occurredAt,
          ledgerTransactionId: null,
          reversalTransactionId: null,
        });
      } else if (this.isNewerFundingEvent(funding, status, occurredAt)) {
        funding.status = status;
        funding.occurredAt = occurredAt;
        if (sourceAmount) funding.sourceAmount = sourceAmount;
        if (status === 'payment_processed') funding.destinationAmount = amount;
      }
      await repository.save(funding);

      if (
        funding.status === 'payment_processed' &&
        !funding.ledgerTransactionId &&
        availableAccount &&
        custodyAccount
      ) {
        const transaction = await this.ledger.postInManager(manager, {
          kind: 'wallet_funding',
          idempotencyKey: `bridge:virtual-account:${virtualAccount.id}:${depositId}:credit`,
          provider: PaymentProvider.BRIDGE,
          providerReference: depositId,
          occurredAt: funding.occurredAt,
          evidence: {
            virtualAccountId: virtualAccount.providerVirtualAccountId,
            webhookEventId: event.event_id,
            destinationTransactionHash:
              typeof value.destination_tx_hash === 'string' ? value.destination_tx_hash : null,
          },
          entries: [
            {
              accountId: custodyAccount.id,
              direction: 'debit',
              amount: funding.destinationAmount ?? amount!,
              currency: virtualAccount.destinationCurrency,
            },
            {
              accountId: availableAccount.id,
              direction: 'credit',
              amount: funding.destinationAmount ?? amount!,
              currency: virtualAccount.destinationCurrency,
            },
          ],
        });
        funding.ledgerTransactionId = transaction.id;
      }

      if (funding.status === 'refunded' && funding.ledgerTransactionId) {
        const reversal = await this.ledger.reverseInManager(
          manager,
          funding.ledgerTransactionId,
          `bridge:virtual-account:${virtualAccount.id}:${depositId}:refund`,
          {
            webhookEventId: event.event_id,
            virtualAccountId: virtualAccount.providerVirtualAccountId,
          },
        );
        funding.reversalTransactionId = reversal.id;
      }
      await repository.save(funding);
    });
  }

  private isNewerFundingEvent(funding: WalletFunding, status: string, occurredAt: Date): boolean {
    if (funding.status === 'refunded' || funding.status === 'refund_failed') return false;
    if (occurredAt.getTime() > funding.occurredAt.getTime()) return true;
    if (occurredAt.getTime() < funding.occurredAt.getTime()) return false;
    return (FUNDING_EVENT_RANK[status] ?? 0) > (FUNDING_EVENT_RANK[funding.status] ?? 0);
  }

  private isPositiveAmount(amount: string): boolean {
    return /^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(amount) && /[1-9]/.test(amount);
  }
}
