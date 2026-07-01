import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NombaVirtualAccountApiService } from 'src/common/services/nomba-virtual-account-api.service';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PaymentMethodStatus } from '../../../../common/enums/payment-method-status.enum';
import { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import { NombaApiService } from '../../subscriptions/services/nomba-api.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import {
  buildNombaAccountRef,
  buildVirtualAccountName,
} from '../utils/wallet-virtual-account.util';

export interface WalletCreditOptions {
  rawAmount?: number;
  nombaEventId?: string;
  metadata?: Record<string, unknown>;
  status?: TenantWalletTransaction['status'];
}

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

  async provisionVirtualAccount(tenantId: string, tenantName?: string): Promise<TenantWallet> {
    const repo = this.dataSource.getRepository(TenantWallet);
    const wallet = await this.ensureWallet(tenantId);

    if (wallet.virtualAccountStatus === 'ACTIVE' && wallet.virtualAccountNumber) {
      return wallet;
    }

    if (!this.nombaVirtualAccountApi.isConfigured()) {
      wallet.virtualAccountStatus = 'FAILED';
      wallet.virtualAccountError = 'Nomba is not configured';
      return repo.save(wallet);
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
      wallet.virtualAccountError = message;
      await repo.save(wallet);
      this.logger.error(`Failed to provision VA for tenant ${tenantId}: ${message}`);
      throw error;
    }
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
      throw new BadRequestException(
        'Insufficient wallet balance. Please fund your rewards wallet to continue.',
      );
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
      try {
        await this.chargeAndCredit(
          tenantId,
          Number(wallet.autoTopupAmount),
          `auto-topup-${randomUUID()}`,
          `Automatic replenishment of rewards wallet (balance below ${wallet.autoTopupThreshold})`,
          manager,
        );
      } catch (error) {
        this.logger.warn(
          `Auto-topup failed for tenant ${tenantId}: ${error instanceof Error ? error.message : error}`,
        );
      }
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

    return updated;
  }

  private async resolveBillingEmail(tenantId: string): Promise<string> {
    try {
      const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const contactEmail = settings.settings.billing?.contactEmail?.trim();
      if (contactEmail) return contactEmail;
    } catch {}

    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      relations: ['createdBy'],
    });
    const fallback = tenant?.createdBy?.email?.trim();
    if (!fallback) {
      throw new BadRequestException('Billing contact email is required for wallet top-up');
    }
    return fallback;
  }

  private async chargeAndCredit(
    tenantId: string,
    amount: number,
    reference: string,
    description: string,
    manager?: EntityManager,
  ): Promise<TenantWallet> {
    if (amount <= 0) {
      throw new BadRequestException('Top up amount must be greater than 0');
    }

    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    const tokenKey = subscription?.paymentMethodId?.trim();
    if (!tokenKey) {
      throw new BadRequestException(
        'No saved payment method on file. Add a card in Billing settings first.',
      );
    }

    const customerEmail = await this.resolveBillingEmail(tenantId);
    const wallet = await this.ensureWallet(tenantId, manager);
    const currency = (wallet.currencyCode || 'NGN').toUpperCase();

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
      throw new BadRequestException('Wallet top-up payment could not be verified');
    }

    return this.credit(tenantId, amount, 'DEPOSIT', reference, description, manager, {
      nombaEventId: charge.orderReference,
    });
  }

  async provisionMissingVirtualAccounts(options?: {
    delayMs?: number;
  }): Promise<{ provisioned: number; skipped: number; failed: number }> {
    if (!this.nombaVirtualAccountApi.isConfigured()) {
      return { provisioned: 0, skipped: 0, failed: 0 };
    }

    const repo = this.dataSource.getRepository(TenantWallet);
    const targets = await repo.find();
    const needing = targets.filter((w) => {
      if (w.virtualAccountStatus === 'ACTIVE' && w.virtualAccountNumber) return false;
      if (w.virtualAccountStatus === 'PROVISIONING' && !this.isProvisioningStale(w)) return false;
      return !w.virtualAccountNumber || w.virtualAccountStatus === 'FAILED' || this.isProvisioningStale(w);
    });

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
    return this.chargeAndCredit(tenantId, amount, reference, description);
  }
}
