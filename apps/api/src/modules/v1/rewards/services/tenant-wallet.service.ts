import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';

@Injectable()
export class TenantWalletService {
  private readonly logger = new Logger(TenantWalletService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Get or create the wallet row for a tenant.
   */
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
      // Handle race condition on unique constraint
      const isDuplicate =
        error instanceof Error &&
        'code' in error &&
        (error as { code?: string }).code === '23505';
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

  /**
   * Atomically debit the wallet balance. Returns the updated wallet.
   * Throws if insufficient balance.
   */
  async debit(
    tenantId: string,
    amount: number,
    reference: string,
    description: string,
    manager: EntityManager,
  ): Promise<TenantWallet> {
    const walletRepo = manager.getRepository(TenantWallet);
    const txRepo = manager.getRepository(TenantWalletTransaction);

    // Atomic decrement with balance check
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

    // Record the spend transaction
    const tx = txRepo.create({
      tenantWalletId: wallet.id,
      type: 'SPENT' as const,
      amount: -amount,
      reference,
      description,
    });
    await txRepo.save(tx);

    return wallet;
  }

  /**
   * Credit the wallet balance (for deposits or refunds).
   */
  async credit(
    tenantId: string,
    amount: number,
    type: 'DEPOSIT' | 'REFUND',
    reference: string,
    description: string,
    manager?: EntityManager,
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
    });
    await txRepo.save(tx);

    return updated;
  }

  /**
   * List wallet transactions for a tenant (most recent first).
   */
  async listTransactions(tenantId: string, limit = 50): Promise<TenantWalletTransaction[]> {
    const wallet = await this.ensureWallet(tenantId);
    return this.dataSource.getRepository(TenantWalletTransaction).find({
      where: { tenantWalletId: wallet.id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
