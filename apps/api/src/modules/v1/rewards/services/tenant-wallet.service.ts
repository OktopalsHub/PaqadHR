import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NombaVirtualAccountApiService } from 'src/common/services/nomba-virtual-account-api.service';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { NombaApiService } from '../../subscriptions/services/nomba-api.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import {
  isAmountWithinTolerance,
  normalizeWebhookAmount,
} from '../../subscriptions/utils/per-seat-pricing.util';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import {
  WALLET_CHARGE_FAILED_ADMIN,
  WALLET_NO_BILLING_CARD,
  WALLET_UNAVAILABLE_MEMBER,
} from '../constants/wallet-error-messages';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import {
  buildNombaAccountRef,
  buildNombaWalletTopupOrderRef,
  buildVirtualAccountName,
} from '../utils/wallet-virtual-account.util';

export interface WalletCreditOptions {
  rawAmount?: number;
  nombaEventId?: string;
  metadata?: Record<string, unknown>;
  status?: TenantWalletTransaction['status'];
}

type ChargeAudience = 'member' | 'admin';

const PROVISIONING_STALE_MS = 15 * 60 * 1000;

@Injectable()
export class TenantWalletService {
  private readonly logger = new Logger(TenantWalletService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly nombaVirtualAccountApi: NombaVirtualAccountApiService,
    private readonly nombaApi: NombaApiService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly emailService: ZeptomailEmailService,
    private readonly activitiesService: ActivitiesService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async ensureWallet(tenantId: string, manager?: EntityManager): Promise<TenantWallet> {
    const repo = manager
      ? manager.getRepository(TenantWallet)
      : this.dataSource.getRepository(TenantWallet);

    let wallet = await repo.findOne({ where: { tenantId } });
    if (wallet) return wallet;

    wallet = repo.create({ tenantId, currencyCode: 'NGN', balanceAmount: 0 });
    try {
      return await repo.save(wallet);
    } catch (error) {
      const isDuplicate =
        error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505';
      if (isDuplicate) {
        const existing = await repo.findOne({ where: { tenantId } });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async ensureWalletWithVirtualAccount(
    tenantId: string,
    tenantName?: string,
  ): Promise<TenantWallet> {
    const wallet = await this.ensureWallet(tenantId);
    if (wallet.virtualAccountStatus === 'ACTIVE' && wallet.virtualAccountNumber) {
      return wallet;
    }
    if (wallet.virtualAccountStatus === 'PROVISIONING' && !this.isProvisioningStale(wallet)) {
      return wallet;
    }
    return this.provisionVirtualAccount(tenantId, tenantName);
  }

  private isProvisioningStale(wallet: TenantWallet): boolean {
    if (wallet.virtualAccountStatus !== 'PROVISIONING') return false;
    const updatedAt = wallet.updatedAt ? new Date(wallet.updatedAt).getTime() : 0;
    return Date.now() - updatedAt > PROVISIONING_STALE_MS;
  }

  private walletNeedsVirtualAccountProvision(wallet: TenantWallet): boolean {
    if (wallet.virtualAccountStatus === 'ACTIVE' && wallet.virtualAccountNumber) return false;
    if (wallet.virtualAccountStatus === 'PROVISIONING' && !this.isProvisioningStale(wallet)) {
      return false;
    }
    return (
      !wallet.virtualAccountNumber ||
      wallet.virtualAccountStatus === 'FAILED' ||
      this.isProvisioningStale(wallet)
    );
  }

  async hasWalletsNeedingVirtualAccountProvision(): Promise<boolean> {
    if (!this.nombaVirtualAccountApi.isConfigured()) return false;
    const targets = await this.dataSource.getRepository(TenantWallet).find();
    return targets.some((wallet) => this.walletNeedsVirtualAccountProvision(wallet));
  }

  async provisionVirtualAccount(tenantId: string, tenantName?: string): Promise<TenantWallet> {
    const repo = this.dataSource.getRepository(TenantWallet);
    const wallet = await this.ensureWallet(tenantId);

    if (wallet.virtualAccountStatus === 'ACTIVE' && wallet.virtualAccountNumber) {
      return wallet;
    }

    if (!this.nombaVirtualAccountApi.isConfigured()) {
      return wallet;
    }

    const name =
      tenantName ??
      (await this.tenantRepository.findOne({ where: { id: tenantId } }))?.name ??
      undefined;
    const accountRef = buildNombaAccountRef(tenantId);
    const accountName = buildVirtualAccountName(name);

    wallet.virtualAccountStatus = 'PROVISIONING';
    wallet.nombaAccountRef = accountRef;
    wallet.virtualAccountError = null;
    await repo.save(wallet);

    try {
      const result = await this.nombaVirtualAccountApi.createVirtualAccount({
        accountRef,
        accountName,
        currency: 'NGN',
      });

      wallet.virtualAccountNumber = result.accountNumber;
      wallet.virtualAccountBank = result.bankName;
      wallet.nombaAccountRef = result.accountRef;
      wallet.virtualAccountStatus = 'ACTIVE';
      wallet.virtualAccountProvisionedAt = new Date();
      wallet.virtualAccountError = null;

      this.logger.log(`Provisioned rewards VA ${result.accountNumber} for tenant ${tenantId}`);
      return repo.save(wallet);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      wallet.virtualAccountStatus = 'FAILED';
      wallet.virtualAccountError = this.sanitizeProviderError(message);
      await repo.save(wallet);
      this.logger.error(`Failed to provision VA for tenant ${tenantId}: ${message}`);
      throw error;
    }
  }

  private sanitizeProviderError(message: string): string {
    if (/not configured|nomba|reloadly/i.test(message)) {
      return 'Deposit account setup is unavailable.';
    }
    return message;
  }

  async getWallet(tenantId: string, tenantName?: string): Promise<TenantWallet> {
    const wallet = await this.ensureWallet(tenantId);
    if (
      wallet.virtualAccountStatus !== 'ACTIVE' &&
      !(wallet.virtualAccountStatus === 'PROVISIONING' && !this.isProvisioningStale(wallet)) &&
      this.nombaVirtualAccountApi.isConfigured()
    ) {
      try {
        return await this.provisionVirtualAccount(tenantId, tenantName);
      } catch {
        return wallet;
      }
    }
    return wallet;
  }

  async debit(
    tenantId: string,
    amount: number,
    reference: string,
    description: string,
    manager: EntityManager,
  ): Promise<TenantWallet> {
    const walletRepo = manager.getRepository(TenantWallet);
    const txRepo = manager.getRepository(TenantWalletTransaction);

    const result = await walletRepo
      .createQueryBuilder()
      .update(TenantWallet)
      .set({ balanceAmount: () => `balance_amount - ${amount}` })
      .where('tenant_id = :tenantId AND balance_amount >= :amount', { tenantId, amount })
      .execute();

    if (result.affected === 0) {
      throw new BadRequestException(WALLET_UNAVAILABLE_MEMBER);
    }

    const wallet = await walletRepo.findOneOrFail({ where: { tenantId } });

    const tx = txRepo.create({
      tenantWalletId: wallet.id,
      type: 'SPENT' as const,
      amount: -amount,
      reference,
      description,
      status: 'COMPLETED',
    });
    await txRepo.save(tx);

    if (
      wallet.autoTopupEnabled &&
      Number(wallet.autoTopupAmount) > 0 &&
      Number(wallet.balanceAmount) <= Number(wallet.autoTopupThreshold)
    ) {
      await this.chargeAndCredit(
        tenantId,
        Number(wallet.autoTopupAmount),
        `auto-topup-${randomUUID()}`,
        `Automatic replenishment of rewards wallet (balance below ${wallet.autoTopupThreshold})`,
        manager,
        'member',
      );
    }

    return walletRepo.findOneOrFail({ where: { tenantId } });
  }

  async credit(
    tenantId: string,
    amount: number,
    type: 'DEPOSIT' | 'REFUND',
    reference: string,
    description: string,
    manager?: EntityManager,
    options?: WalletCreditOptions,
  ): Promise<TenantWallet> {
    const mgr = manager ?? this.dataSource.manager;
    const walletRepo = mgr.getRepository(TenantWallet);
    const txRepo = mgr.getRepository(TenantWalletTransaction);

    const wallet = await this.ensureWallet(tenantId, mgr);

    await walletRepo
      .createQueryBuilder()
      .update(TenantWallet)
      .set({ balanceAmount: () => `balance_amount + ${amount}` })
      .where('tenant_id = :tenantId', { tenantId })
      .execute();

    const updated = await walletRepo.findOneOrFail({ where: { tenantId } });

    const tx = txRepo.create({
      tenantWalletId: wallet.id,
      type,
      amount,
      reference,
      description,
      status: options?.status ?? 'COMPLETED',
      rawAmount: options?.rawAmount ?? amount,
      nombaEventId: options?.nombaEventId ?? null,
      metadata: options?.metadata ?? null,
    });
    await txRepo.save(tx);

    if (type === 'DEPOSIT') {
      void this.activitiesService
        .queueActivity({
          tenantId,
          action: 'wallet.deposit',
          resourceType: 'rewards_wallet',
          resourceId: reference,
          description,
          metadata: { amount, reference },
        })
        .catch((err) => {
          this.logger.warn(
            `Failed to queue wallet deposit activity: ${err instanceof Error ? err.message : err}`,
          );
        });
    }

    return updated;
  }

  private async resolveBillingEmail(tenantId: string): Promise<string | null> {
    try {
      const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const contactEmail = settings.settings.billing?.contactEmail?.trim();
      if (contactEmail) return contactEmail;
    } catch {}

    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      relations: ['createdBy'],
    });
    return tenant?.createdBy?.email?.trim() ?? null;
  }

  private notifyWalletChargeFailed(
    tenantId: string,
    amount: number,
    currency: string,
    reason: string,
  ): void {
    void this.sendWalletChargeFailedEmail(tenantId, amount, currency, reason).catch((err) => {
      this.logger.warn(
        `Failed to send wallet charge failure email for tenant ${tenantId}: ${err instanceof Error ? err.message : err}`,
      );
    });
  }

  private async sendWalletChargeFailedEmail(
    tenantId: string,
    amount: number,
    currency: string,
    reason: string,
  ): Promise<void> {
    const email = await this.resolveBillingEmail(tenantId);
    if (!email) return;

    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const settingsUrl = `${frontendUrl}/settings?tab=rewards`;

    await this.emailService.sendEmail({
      to: email,
      subject: 'Paqad: Rewards wallet payment failed',
      text: [
        `A rewards wallet payment failed for ${tenant?.name ?? 'your workspace'}.`,
        `Amount: ${currency} ${amount.toLocaleString()}`,
        `Reason: ${reason}`,
        `Update billing or fund via bank transfer: ${settingsUrl}`,
      ].join('\n'),
      html: `<p>A rewards wallet payment failed for <strong>${tenant?.name ?? 'your workspace'}</strong>.</p>
<p>Amount: <strong>${currency} ${amount.toLocaleString()}</strong></p>
<p>Reason: ${reason}</p>
<p><a href="${settingsUrl}">Open Rewards &amp; Billing settings</a></p>`,
    });
  }

  private async chargeAndCredit(
    tenantId: string,
    amount: number,
    reference: string,
    description: string,
    manager?: EntityManager,
    audience: ChargeAudience = 'admin',
  ): Promise<TenantWallet> {
    if (amount <= 0) {
      throw new BadRequestException('Top up amount must be greater than 0');
    }

    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    const tokenKey = subscription?.paymentMethodId?.trim();
    if (!tokenKey) {
      throw new BadRequestException(
        audience === 'admin' ? WALLET_NO_BILLING_CARD : WALLET_UNAVAILABLE_MEMBER,
      );
    }

    let customerEmail: string;
    try {
      const resolved = await this.resolveBillingEmail(tenantId);
      if (!resolved) {
        throw new Error('Billing contact email is not configured');
      }
      customerEmail = resolved;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.notifyWalletChargeFailed(tenantId, amount, 'NGN', reason);
      throw new BadRequestException(
        audience === 'admin' ? WALLET_CHARGE_FAILED_ADMIN : WALLET_UNAVAILABLE_MEMBER,
      );
    }

    const wallet = await this.ensureWallet(tenantId, manager);
    const currency = (wallet.currencyCode || 'NGN').toUpperCase();

    try {
      const charge = await this.nombaApi.chargeTokenizedCard({
        orderReference: reference,
        customerEmail,
        amount,
        currency,
        callbackUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        tokenKey,
        meta: { tenantId, billingType: 'wallet_topup' },
      });

      const verified = await this.nombaApi.verifyTransaction(charge.orderReference);
      if (verified?.status?.toLowerCase() !== 'success') {
        throw new Error('Payment verification failed');
      }

      const normalizedPaid = normalizeWebhookAmount(Number(verified.amount ?? 0), amount, currency);
      if (!Number.isFinite(normalizedPaid) || !isAmountWithinTolerance(normalizedPaid, amount)) {
        throw new Error(
          `Payment amount mismatch (expected ${amount}, got ${verified.amount ?? 'unknown'})`,
        );
      }

      return this.credit(tenantId, amount, 'DEPOSIT', reference, description, manager, {
        nombaEventId: charge.orderReference,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.notifyWalletChargeFailed(tenantId, amount, currency, reason);
      throw new BadRequestException(
        audience === 'admin' ? WALLET_CHARGE_FAILED_ADMIN : WALLET_UNAVAILABLE_MEMBER,
      );
    }
  }

  async provisionMissingVirtualAccounts(options?: {
    delayMs?: number;
  }): Promise<{ provisioned: number; skipped: number; failed: number }> {
    if (!this.nombaVirtualAccountApi.isConfigured()) {
      return { provisioned: 0, skipped: 0, failed: 0 };
    }

    const repo = this.dataSource.getRepository(TenantWallet);
    const targets = await repo.find();
    const needing = targets.filter((wallet) => this.walletNeedsVirtualAccountProvision(wallet));

    let provisioned = 0;
    let skipped = 0;
    let failed = 0;
    const delayMs = options?.delayMs ?? 200;

    for (const wallet of needing) {
      if (wallet.virtualAccountStatus === 'ACTIVE' && wallet.virtualAccountNumber) {
        skipped += 1;
        continue;
      }

      const tenant = await this.tenantRepository.findOne({ where: { id: wallet.tenantId } });
      try {
        await this.provisionVirtualAccount(wallet.tenantId, tenant?.name);
        provisioned += 1;
      } catch {
        failed += 1;
      }

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return { provisioned, skipped, failed };
  }

  async listTransactions(tenantId: string, limit = 50): Promise<TenantWalletTransaction[]> {
    const wallet = await this.ensureWallet(tenantId);
    return this.dataSource.getRepository(TenantWalletTransaction).find({
      where: { tenantWalletId: wallet.id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async updateAutoTopupConfig(
    tenantId: string,
    enabled: boolean,
    threshold: number,
    amount: number,
  ): Promise<TenantWallet> {
    const repo = this.dataSource.getRepository(TenantWallet);
    const wallet = await this.ensureWallet(tenantId);
    wallet.autoTopupEnabled = enabled;
    wallet.autoTopupThreshold = threshold;
    wallet.autoTopupAmount = amount;
    return repo.save(wallet);
  }

  async manualTopup(tenantId: string, amount: number): Promise<TenantWallet> {
    const reference = `manual-topup-${randomUUID()}`;
    const description = 'Manual rewards wallet top-up via saved payment method';
    return this.chargeAndCredit(tenantId, amount, reference, description, undefined, 'admin');
  }

  async createTopupCheckout(
    tenantId: string,
    amount: number,
  ): Promise<{ checkoutUrl: string; orderReference: string }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Top up amount must be greater than 0');
    }
    if (!this.nombaApi.isConfigured()) {
      throw new BadRequestException('Nomba checkout is not configured');
    }

    const customerEmail = await this.resolveBillingEmail(tenantId);
    if (!customerEmail) {
      throw new BadRequestException(
        'Billing contact email is not configured. Add it in Settings → Billing.',
      );
    }

    const wallet = await this.ensureWallet(tenantId);
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const callbackUrl = tenant?.slug
      ? `${frontendBase}/${tenant.slug}/settings?tab=rewards&wallet_topup=done`
      : `${frontendBase}/settings?tab=rewards&wallet_topup=done`;

    const orderReference = buildNombaWalletTopupOrderRef(tenantId);
    const result = await this.nombaApi.createCheckoutOrder({
      orderReference,
      customerEmail,
      amount,
      currency: (wallet.currencyCode || 'NGN').toUpperCase(),
      callbackUrl,
      tokenizeCard: false,
      meta: {
        tenantId,
        billingType: 'wallet_topup',
        expectedAmount: amount,
      },
    });

    return {
      checkoutUrl: result.checkoutLink,
      orderReference: result.orderReference,
    };
  }

  /**
   * Credits wallet after Nomba checkout payment_success for billingType=wallet_topup.
   * Idempotent on orderReference.
   */
  async completeCheckoutTopup(input: {
    tenantId: string;
    orderReference: string;
    amount?: number;
  }): Promise<{ received: boolean; credited: boolean }> {
    const txRepo = this.dataSource.getRepository(TenantWalletTransaction);
    const existing = await txRepo.findOne({ where: { reference: input.orderReference } });
    if (existing) {
      return { received: true, credited: false };
    }

    const verified = await this.nombaApi.verifyTransaction(input.orderReference);
    const status = verified?.status?.toLowerCase() ?? '';
    if (status !== 'success' && status !== 'successful') {
      this.logger.warn(
        `Wallet checkout top-up not yet successful for ${input.orderReference}: ${status || 'unknown'}`,
      );
      return { received: true, credited: false };
    }

    const wallet = await this.ensureWallet(input.tenantId);
    const currency = (wallet.currencyCode || 'NGN').toUpperCase();
    const expected = input.amount ?? Number(verified?.amount ?? 0);
    const paid = normalizeWebhookAmount(Number(verified?.amount ?? 0), expected, currency);
    if (!Number.isFinite(paid) || paid <= 0) {
      this.logger.warn(`Wallet checkout top-up invalid amount for ${input.orderReference}`);
      return { received: true, credited: false };
    }

    if (
      input.amount &&
      Number.isFinite(input.amount) &&
      !isAmountWithinTolerance(paid, input.amount)
    ) {
      this.logger.warn(
        `Wallet checkout top-up amount mismatch for ${input.orderReference}: expected ${input.amount}, got ${paid}`,
      );
      return { received: true, credited: false };
    }

    await this.credit(
      input.tenantId,
      paid,
      'DEPOSIT',
      input.orderReference,
      'Rewards wallet top-up via Nomba checkout',
      undefined,
      { nombaEventId: input.orderReference },
    );
    this.logger.log(
      `Credited wallet ${input.tenantId} for checkout top-up ${input.orderReference}`,
    );
    return { received: true, credited: true };
  }
}
