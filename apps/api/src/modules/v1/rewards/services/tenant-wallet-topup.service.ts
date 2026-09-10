import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { resolveRewardsWalletPaymentProvider } from '../config/rewards-wallet-provider.config';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { buildWalletTopupOrderRef } from '../utils/wallet-order-ref.util';
import { TenantWalletService } from './tenant-wallet.service';
import { TopupChargeService } from './topup-charge.service';
import { TopupCheckoutService } from './topup-checkout.service';
import { TopupWebhookService } from './topup-webhook.service';

@Injectable()
export class TenantWalletTopupService {
  private readonly logger = new Logger(TenantWalletTopupService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: TenantWalletService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly checkoutService: TopupCheckoutService,
    private readonly webhookService: TopupWebhookService,
    private readonly chargeService: TopupChargeService,
  ) {}

  async manualTopup(
    tenantId: string,
    amount: number,
    initiatedByMemberId: string,
  ): Promise<TenantWallet> {
    const wallet = await this.walletService.ensureWallet(tenantId);
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const provider = resolveRewardsWalletPaymentProvider(tenant?.countryCode, wallet.currencyCode);
    const reference =
      provider === PaymentProvider.MONNIFY
        ? buildWalletTopupOrderRef(PaymentProvider.MONNIFY, tenantId)
        : `manual-topup-${randomUUID()}`;
    return this.chargeService.chargeAndCredit(
      tenantId,
      amount,
      reference,
      'Manual rewards wallet top-up via saved payment method',
      undefined,
      'admin',
      initiatedByMemberId,
    );
  }

  async createTopupCheckout(
    tenantId: string,
    amount: number,
    initiatedByMemberId: string,
  ): Promise<{ checkoutUrl: string; orderReference: string; transactionReference?: string }> {
    return this.checkoutService.createTopupCheckout(tenantId, amount, initiatedByMemberId, (id) =>
      this.chargeService.resolveBillingEmail(id),
    );
  }

  async completeCheckoutTopup(
    input: {
      tenantId: string;
      orderReference: string;
      amount?: number;
      transactionReference?: string;
      initiatedByMemberId?: string;
    },
    billingProvider: PaymentProvider = PaymentProvider.NOMBA,
  ): Promise<{ received: boolean; credited: boolean; retryable?: boolean }> {
    return this.webhookService.completeCheckoutTopup(
      input,
      billingProvider,
      (inp, verified) => this.webhookService.resolveCheckoutActorMemberId(inp, verified),
      (tenantId, amount, type, reference, description, manager, metadata) =>
        this.walletService.credit(
          tenantId,
          amount,
          type as 'DEPOSIT',
          reference,
          description,
          manager as EntityManager | undefined,
          {
            actorMemberId: metadata.actorMemberId ?? '',
            providerEventId: metadata.providerEventId,
          },
        ),
    );
  }

  async maybeAutoTopupAfterDebit(tenantId: string, actorMemberId: string): Promise<void> {
    const wallet = await this.dataSource
      .getRepository(TenantWallet)
      .findOneOrFail({ where: { tenantId } });
    if (
      !wallet.autoTopupEnabled ||
      Number(wallet.autoTopupAmount) <= 0 ||
      Number(wallet.balanceAmount) > Number(wallet.autoTopupThreshold)
    ) {
      return;
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const walletProvider = resolveRewardsWalletPaymentProvider(
      tenant?.countryCode,
      wallet.currencyCode,
    );
    if (walletProvider === PaymentProvider.BACHS || walletProvider === PaymentProvider.FINCRA) {
      this.logger.debug(
        `Skipping auto-topup for tenant ${tenantId}: saved-card top-up is unavailable on ${walletProvider}`,
      );
      return;
    }

    const chargeReference =
      walletProvider === PaymentProvider.MONNIFY
        ? buildWalletTopupOrderRef(PaymentProvider.MONNIFY, tenantId)
        : `auto-topup-${randomUUID()}`;

    await this.chargeService.chargeAndCredit(
      tenantId,
      Number(wallet.autoTopupAmount),
      chargeReference,
      `Automatic replenishment of rewards wallet (balance below ${wallet.autoTopupThreshold})`,
      undefined,
      'member',
      this.chargeService.requireInitiatingTenantMemberId(actorMemberId),
    );
  }
}
