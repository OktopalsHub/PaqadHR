import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import type { CheckoutVerificationResult } from 'src/common/interfaces/checkout-provider.interface';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { DEFAULT_WALLET_CURRENCY_FALLBACK } from 'src/common/utils/rewards-defaults.util';
import { DataSource } from 'typeorm';
import { BILLING_AMOUNT_TOLERANCE } from '../../subscriptions/constants/billing.constants';
import { normalizeWebhookAmount } from '../../subscriptions/utils/per-seat-pricing.util';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import { TenantWalletService, type WalletCreditOptions } from './tenant-wallet.service';

@Injectable()
export class TopupWebhookService {
  private readonly logger = new Logger(TopupWebhookService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: TenantWalletService,
    private readonly factory: PaymentProviderFactoryService,
  ) {}

  async completeCheckoutTopup(
    input: {
      tenantId: string;
      orderReference: string;
      amount?: number;
      transactionReference?: string;
      initiatedByMemberId?: string;
    },
    billingProvider: PaymentProvider,
    resolveActorMemberId: (
      input: { initiatedByMemberId?: string },
      verified: CheckoutVerificationResult | null,
    ) => string | undefined,
    creditWallet: (
      tenantId: string,
      amount: number,
      type: string,
      reference: string,
      description: string,
      manager: unknown,
      metadata: WalletCreditOptions,
    ) => Promise<TenantWallet>,
  ): Promise<{ received: boolean; credited: boolean; retryable?: boolean }> {
    const existing = await this.dataSource.getRepository(TenantWalletTransaction).findOne({
      where: { reference: input.orderReference },
    });
    if (existing) {
      return { received: true, credited: existing.type === 'DEPOSIT' };
    }

    const wallet = await this.walletService.ensureWallet(input.tenantId);
    const currency = (wallet.currencyCode || DEFAULT_WALLET_CURRENCY_FALLBACK).toUpperCase();

    const adapter = this.factory.resolveCheckoutAdapter(billingProvider);
    const verified = adapter
      ? await adapter.verifyCheckout({
          orderReference: input.orderReference,
          transactionReference: input.transactionReference,
        })
      : null;

    const status = verified?.status?.toLowerCase() ?? '';
    if (
      status !== 'success' &&
      status !== 'successful' &&
      status !== 'succeeded' &&
      status !== 'accepted'
    ) {
      this.logger.warn(
        `Wallet checkout top-up not yet successful for ${input.orderReference}: ${status || 'unknown'}`,
      );
      return { received: true, credited: false, retryable: true };
    }

    const expected = input.amount ?? Number(verified?.amount ?? 0);
    const verifiedAmount = Number(verified?.amount ?? 0);
    const rawPaid =
      Number.isFinite(verifiedAmount) && verifiedAmount > 0
        ? verifiedAmount
        : Number.isFinite(expected) && expected > 0
          ? expected
          : verifiedAmount;
    const paid = normalizeWebhookAmount(rawPaid, expected > 0 ? expected : rawPaid, currency);
    if (!Number.isFinite(paid) || paid <= 0) {
      this.logger.warn(`Wallet checkout top-up invalid amount for ${input.orderReference}`);
      return { received: true, credited: false };
    }

    if (input.amount && Number.isFinite(input.amount) && input.amount > 0) {
      if (paid + BILLING_AMOUNT_TOLERANCE < input.amount) {
        this.logger.warn(
          `Wallet checkout top-up underpaid for ${input.orderReference}: expected ${input.amount}, got ${paid}`,
        );
        return { received: true, credited: false };
      }
    }

    const creditResult = await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(TenantWallet)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.tenantId = :tenantId', { tenantId: input.tenantId })
        .getOneOrFail();

      const dup = await manager.getRepository(TenantWalletTransaction).findOne({
        where: { reference: input.orderReference },
      });
      if (dup) {
        return { received: true, credited: false };
      }

      const actorMemberId = resolveActorMemberId(input, verified ?? null);

      await creditWallet(
        input.tenantId,
        paid,
        'DEPOSIT',
        input.orderReference,
        `Rewards wallet top-up via checkout`,
        manager,
        {
          providerEventId: input.orderReference,
          actorMemberId: actorMemberId ?? '',
        },
      );
      this.logger.log(
        `Credited wallet ${input.tenantId} for checkout top-up ${input.orderReference}`,
      );
      return { received: true, credited: true };
    });

    return creditResult;
  }

  resolveCheckoutActorMemberId(
    input: { initiatedByMemberId?: string },
    verified: { metaData?: Record<string, unknown> } | Record<string, unknown> | null,
  ): string | undefined {
    const fromInput = input.initiatedByMemberId?.trim();
    if (fromInput) return fromInput;
    const meta =
      verified && 'metaData' in verified
        ? (verified.metaData as Record<string, unknown> | undefined)
        : undefined;
    const fromMeta = meta?.initiatedByMemberId;
    if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim();
    return undefined;
  }
}
