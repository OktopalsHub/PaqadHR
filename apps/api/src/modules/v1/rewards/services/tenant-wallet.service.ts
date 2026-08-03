import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import {
  isWalletCurrencyLocked,
  resolveInitialWalletCurrency,
} from 'src/common/utils/rewards-defaults.util';
import { DataSource, EntityManager } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { TenantsService } from '../../tenants/tenants.service';
import { resolveRewardsWalletPaymentProvider } from '../config/rewards-wallet-provider.config';
import {
  WALLET_SAVED_CARD_UNSUPPORTED,
  WALLET_UNAVAILABLE_MEMBER,
} from '../constants/wallet-error-messages';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';

export interface WalletCreditOptions {
  rawAmount?: number;
  providerEventId?: string;
  metadata?: Record<string, unknown>;
  status?: TenantWalletTransaction['status'];
  actorMemberId?: string | null;
}

@Injectable()
export class TenantWalletService {
  private readonly logger = new Logger(TenantWalletService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly activitiesService: ActivitiesService,
    private readonly tenantsService: TenantsService,
  ) {}

  async ensureWallet(tenantId: string, manager?: EntityManager): Promise<TenantWallet> {
    const repo = manager
      ? manager.getRepository(TenantWallet)
      : this.dataSource.getRepository(TenantWallet);

    let wallet = await repo.findOne({ where: { tenantId } });
    if (wallet) {
      return this.syncWalletCurrencyIfSafe(tenantId, wallet, manager);
    }

    let currencyCode = 'USD';
    try {
      const tenant = await this.tenantsService.getTenant(tenantId);
      currencyCode = resolveInitialWalletCurrency(tenant.countryCode, tenant.preferredCurrency);
    } catch (error) {
      this.logger.warn(
        `Failed to resolve tenant currency for wallet ${tenantId}, defaulting to USD: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    wallet = repo.create({ tenantId, currencyCode, balanceAmount: 0 });
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

  async getWallet(tenantId: string): Promise<TenantWallet> {
    return this.ensureWallet(tenantId);
  }

  async getTenantCountryCode(tenantId: string): Promise<string | null> {
    try {
      const tenant = await this.tenantsService.getTenant(tenantId);
      return tenant.countryCode ?? null;
    } catch {
      return null;
    }
  }

  private async syncWalletCurrencyIfSafe(
    tenantId: string,
    wallet: TenantWallet,
    manager?: EntityManager,
  ): Promise<TenantWallet> {
    const walletRepo = manager
      ? manager.getRepository(TenantWallet)
      : this.dataSource.getRepository(TenantWallet);
    const txRepo = manager
      ? manager.getRepository(TenantWalletTransaction)
      : this.dataSource.getRepository(TenantWalletTransaction);

    const transactionCount = await txRepo.count({
      where: { tenantWalletId: wallet.id },
    });
    if (isWalletCurrencyLocked(wallet, transactionCount)) {
      return wallet;
    }

    const desiredCurrency = await this.resolveTenantWalletCurrency(tenantId);
    if (!desiredCurrency || desiredCurrency === wallet.currencyCode) {
      return wallet;
    }

    wallet.currencyCode = desiredCurrency;
    return walletRepo.save(wallet);
  }

  async isWalletCurrencyLockedForTenant(tenantId: string): Promise<boolean> {
    const wallet = await this.dataSource
      .getRepository(TenantWallet)
      .findOne({ where: { tenantId } });
    if (!wallet) {
      return false;
    }
    const transactionCount = await this.dataSource.getRepository(TenantWalletTransaction).count({
      where: { tenantWalletId: wallet.id },
    });
    return isWalletCurrencyLocked(wallet, transactionCount);
  }

  async getWalletCurrencyCode(tenantId: string): Promise<string> {
    const wallet = await this.ensureWallet(tenantId);
    return wallet.currencyCode.toUpperCase();
  }

  private async resolveTenantWalletCurrency(tenantId: string): Promise<string | null> {
    try {
      const tenant = await this.tenantsService.getTenant(tenantId);
      return resolveInitialWalletCurrency(tenant.countryCode, tenant.preferredCurrency);
    } catch (error) {
      this.logger.warn(
        `Failed to resolve tenant currency for wallet ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async debit(
    tenantId: string,
    amount: number,
    reference: string,
    description: string,
    manager: EntityManager,
  ): Promise<TenantWallet> {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid debit amount');
    }
    const walletRepo = manager.getRepository(TenantWallet);
    const txRepo = manager.getRepository(TenantWalletTransaction);

    const result = await walletRepo
      .createQueryBuilder()
      .update(TenantWallet)
      .set({ balanceAmount: () => 'balance_amount - :amount' })
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
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid credit amount');
    }
    const mgr = manager ?? this.dataSource.manager;
    const walletRepo = mgr.getRepository(TenantWallet);
    const txRepo = mgr.getRepository(TenantWalletTransaction);

    const wallet = await this.ensureWallet(tenantId, mgr);

    await walletRepo
      .createQueryBuilder()
      .update(TenantWallet)
      .set({ balanceAmount: () => 'balance_amount + :amount' })
      .where('tenant_id = :tenantId', { tenantId, amount })
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
      providerEventId: options?.providerEventId ?? null,
      metadata: options?.metadata ?? null,
    });
    await txRepo.save(tx);

    if (type === 'DEPOSIT') {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId: options?.actorMemberId ?? null,
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
    actorMemberId?: string,
  ): Promise<TenantWallet> {
    const repo = this.dataSource.getRepository(TenantWallet);
    const wallet = await this.ensureWallet(tenantId);
    if (enabled) {
      const tenant = await this.tenantsService.getTenant(tenantId);
      if (resolveRewardsWalletPaymentProvider(tenant.countryCode) === PaymentProvider.MONNIFY) {
        throw new BadRequestException(WALLET_SAVED_CARD_UNSUPPORTED);
      }
    }
    wallet.autoTopupEnabled = enabled;
    wallet.autoTopupThreshold = threshold;
    wallet.autoTopupAmount = amount;
    const saved = await repo.save(wallet);
    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'wallet.auto_topup_updated',
          resourceType: 'rewards_wallet',
          resourceId: wallet.id,
          description: enabled
            ? `Auto top-up enabled (${amount} when balance falls below ${threshold})`
            : 'Auto top-up disabled',
          metadata: { enabled, threshold, amount },
        })
        .catch((err) => {
          this.logger.warn(
            `Failed to queue auto-topup activity: ${err instanceof Error ? err.message : err}`,
          );
        });
    }
    return saved;
  }
}
