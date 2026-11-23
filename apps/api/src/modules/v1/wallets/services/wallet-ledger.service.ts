import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import { WalletLedgerAccount } from '../entities/wallet-ledger-account.entity';
import { WalletLedgerEntry } from '../entities/wallet-ledger-entry.entity';
import { WalletLedgerTransaction } from '../entities/wallet-ledger-transaction.entity';

const DECIMAL_SCALE = 12n;
const DECIMAL_FACTOR = 10n ** DECIMAL_SCALE;

export interface WalletJournalEntryInput {
  accountId: string;
  direction: 'debit' | 'credit';
  amount: string;
  currency: string;
}

export interface PostWalletJournalInput {
  kind: string;
  idempotencyKey: string;
  provider?: string | null;
  providerReference?: string | null;
  occurredAt?: Date | null;
  reversesTransactionId?: string | null;
  evidence?: Record<string, unknown> | null;
  entries: WalletJournalEntryInput[];
}

export interface EnsureWalletLedgerAccountInput {
  ownerType: 'organization' | 'employee' | 'system';
  tenantId?: string | null;
  userId?: string | null;
  accountType: 'available' | 'reserved' | 'clearing' | 'fee' | 'custody' | 'revenue';
  currency: string;
  network?: string | null;
  normalSide?: 'debit' | 'credit';
}

@Injectable()
export class WalletLedgerService {
  constructor(private readonly dataSource: DataSource) {}

  async ensureAccount(input: EnsureWalletLedgerAccountInput): Promise<WalletLedgerAccount> {
    const owner = this.normalizeAccountOwner(input);
    const currency = input.currency.trim().toUpperCase();
    const network = input.network?.trim().toUpperCase() || null;
    const ownerAccount = input.ownerType !== 'system';
    const normalSide = ownerAccount ? 'credit' : input.normalSide;
    if (!/^[A-Z0-9]{3,10}$/.test(currency) || !normalSide) {
      throw new ConflictException('Wallet ledger account currency or normal side is invalid.');
    }
    if (ownerAccount && input.accountType !== 'available' && input.accountType !== 'reserved') {
      throw new ConflictException('Owner wallet accounts must be available or reserved accounts.');
    }
    const repository = this.dataSource.getRepository(WalletLedgerAccount);
    if (
      input.ownerType === 'system' &&
      !['clearing', 'fee', 'custody', 'revenue'].includes(input.accountType)
    ) {
      throw new ConflictException('System ledger accounts must use a system account type.');
    }
    const criteria = {
      ...this.accountOwnerWhere(owner),
      accountType: input.accountType,
      currency,
      network: network ?? IsNull(),
    };
    const existing = await repository.findOne({ where: criteria });
    if (existing) {
      if (existing.normalSide !== normalSide) {
        throw new ConflictException('Wallet ledger account normal side cannot be changed.');
      }
      return existing;
    }
    try {
      return await repository.save(
        repository.create({
          ...owner,
          accountType: input.accountType,
          currency,
          network,
          normalSide,
          status: 'active',
        }),
      );
    } catch (error) {
      const concurrent = await repository.findOne({ where: criteria });
      if (concurrent?.normalSide === normalSide) return concurrent;
      throw error;
    }
  }

  async getBalance(accountId: string): Promise<string> {
    const repository = this.dataSource.getRepository(WalletLedgerAccount);
    const account = await repository.findOne({
      where: { id: accountId },
      select: { id: true, normalSide: true },
    });
    if (!account) throw new ConflictException('Wallet ledger account was not found.');
    return this.getBalanceInManager(this.dataSource.manager, account.id, account.normalSide);
  }

  async reserveFunds(input: {
    availableAccountId: string;
    reservedAccountId: string;
    amount: string;
    currency: string;
    idempotencyKey: string;
    kind?: string;
  }): Promise<WalletLedgerTransaction> {
    return this.dataSource.transaction((manager) => this.reserveFundsInManager(manager, input));
  }

  async reserveFundsInManager(
    manager: EntityManager,
    input: {
      availableAccountId: string;
      reservedAccountId: string;
      amount: string;
      currency: string;
      idempotencyKey: string;
      kind?: string;
    },
  ): Promise<WalletLedgerTransaction> {
    const normalized = this.normalize({
      kind: input.kind ?? 'payroll_reservation',
      idempotencyKey: input.idempotencyKey,
      entries: [
        {
          accountId: input.availableAccountId,
          direction: 'debit',
          amount: input.amount,
          currency: input.currency,
        },
        {
          accountId: input.reservedAccountId,
          direction: 'credit',
          amount: input.amount,
          currency: input.currency,
        },
      ],
    });
    const existing = await manager.getRepository(WalletLedgerTransaction).findOne({
      where: { idempotencyKey: normalized.idempotencyKey },
    });
    if (existing) {
      await this.assertSameJournal(existing, normalized, manager);
      return existing;
    }
    const accounts = await this.lockAccounts(manager, [
      input.availableAccountId,
      input.reservedAccountId,
    ]);
    // Another request using this idempotency key may have committed while this
    // request waited for the account locks. Recheck before evaluating funds.
    const committed = await manager.getRepository(WalletLedgerTransaction).findOne({
      where: { idempotencyKey: normalized.idempotencyKey },
    });
    if (committed) {
      await this.assertSameJournal(committed, normalized, manager);
      return committed;
    }
    const available = accounts.find((account) => account.id === input.availableAccountId);
    const reserved = accounts.find((account) => account.id === input.reservedAccountId);
    this.assertMatchingOwnerAccounts(available, reserved, input.currency);
    const balance = await this.getBalanceInManager(manager, available.id, available.normalSide);
    if (this.toSignedUnits(balance) < this.toUnits(this.normalizeAmount(input.amount))) {
      throw new ConflictException('Wallet does not have enough available funds.');
    }
    return this.postInTransaction(manager, normalized);
  }

  async post(input: PostWalletJournalInput): Promise<WalletLedgerTransaction> {
    const normalized = this.normalize(input);
    const existing = await this.findExisting(normalized.idempotencyKey);
    if (existing) {
      await this.assertSameJournal(existing, normalized);
      return existing;
    }

    try {
      return await this.dataSource.transaction((manager) =>
        this.postInTransaction(manager, normalized),
      );
    } catch (error) {
      const concurrent = await this.findExisting(normalized.idempotencyKey);
      if (!concurrent) throw error;
      await this.assertSameJournal(concurrent, normalized);
      return concurrent;
    }
  }

  async postInManager(
    manager: EntityManager,
    input: PostWalletJournalInput,
  ): Promise<WalletLedgerTransaction> {
    const normalized = this.normalize(input);
    const existing = await manager.getRepository(WalletLedgerTransaction).findOne({
      where: { idempotencyKey: normalized.idempotencyKey },
    });
    if (existing) {
      await this.assertSameJournal(existing, normalized, manager);
      return existing;
    }
    return this.postInTransaction(manager, normalized);
  }

  async findByProviderReference(
    provider: string,
    providerReference: string,
  ): Promise<WalletLedgerTransaction | null> {
    return this.dataSource.getRepository(WalletLedgerTransaction).findOne({
      where: { provider, providerReference },
      select: { id: true, status: true, provider: true, providerReference: true },
    });
  }

  async reverse(
    transactionId: string,
    idempotencyKey: string,
    evidence?: Record<string, unknown> | null,
  ): Promise<WalletLedgerTransaction> {
    return this.dataSource.transaction((manager) =>
      this.reverseInManager(manager, transactionId, idempotencyKey, evidence),
    );
  }

  async reverseInManager(
    manager: EntityManager,
    transactionId: string,
    idempotencyKey: string,
    evidence?: Record<string, unknown> | null,
  ): Promise<WalletLedgerTransaction> {
    const transactions = manager.getRepository(WalletLedgerTransaction);
    const original = await transactions
      .createQueryBuilder('transaction')
      .setLock('pessimistic_write')
      .where('transaction.id = :transactionId', { transactionId })
      .getOne();
    const priorReversal = await transactions.findOne({ where: { idempotencyKey } });
    if (priorReversal) {
      if (priorReversal.reversesTransactionId !== transactionId) {
        throw new ConflictException(
          'Wallet reversal idempotency key was used for another transaction.',
        );
      }
      return priorReversal;
    }
    if (original?.status !== 'posted') {
      throw new ConflictException('Only a posted wallet transaction can be reversed.');
    }
    const entries = await manager.getRepository(WalletLedgerEntry).find({
      where: { transactionId },
      order: { id: 'ASC' },
    });
    const input = this.normalize({
      kind: 'reversal',
      idempotencyKey,
      provider: original.provider,
      providerReference: null,
      reversesTransactionId: original.id,
      evidence,
      entries: entries.map((entry) => ({
        accountId: entry.accountId,
        direction: entry.direction === 'debit' ? 'credit' : 'debit',
        amount: entry.amount,
        currency: entry.currency,
      })),
    });
    const reversal = await this.postInTransaction(manager, input);
    original.status = 'reversed';
    await transactions.save(original);
    return reversal;
  }

  private async postInTransaction(
    manager: EntityManager,
    input: PostWalletJournalInput,
  ): Promise<WalletLedgerTransaction> {
    const transactions = manager.getRepository(WalletLedgerTransaction);
    const entries = manager.getRepository(WalletLedgerEntry);
    const transaction = transactions.create({
      kind: input.kind,
      status: 'pending',
      idempotencyKey: input.idempotencyKey,
      provider: input.provider ?? null,
      providerReference: input.providerReference ?? null,
      occurredAt: input.occurredAt ?? null,
      reversesTransactionId: input.reversesTransactionId ?? null,
      evidence: input.evidence ?? null,
    });
    await transactions.save(transaction);
    await entries.save(
      input.entries.map((entry) =>
        entries.create({
          transactionId: transaction.id,
          accountId: entry.accountId,
          direction: entry.direction,
          amount: entry.amount,
          currency: entry.currency,
        }),
      ),
    );
    transaction.status = 'posted';
    return transactions.save(transaction);
  }

  private async findExisting(idempotencyKey: string): Promise<WalletLedgerTransaction | null> {
    return this.dataSource.getRepository(WalletLedgerTransaction).findOne({
      where: { idempotencyKey },
    });
  }

  private async assertSameJournal(
    transaction: WalletLedgerTransaction,
    expected: PostWalletJournalInput,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    const entries = await manager.getRepository(WalletLedgerEntry).find({
      where: { transactionId: transaction.id },
      order: { id: 'ASC' },
    });
    const actual = this.canonicalEntries(entries);
    const wanted = this.canonicalEntries(expected.entries);
    if (
      transaction.status === 'pending' ||
      transaction.kind !== expected.kind ||
      transaction.provider !== (expected.provider ?? null) ||
      transaction.providerReference !== (expected.providerReference ?? null) ||
      transaction.reversesTransactionId !== (expected.reversesTransactionId ?? null) ||
      actual !== wanted
    ) {
      throw new ConflictException(
        'Wallet ledger idempotency key was already used for different journal data.',
      );
    }
  }

  private normalize(input: PostWalletJournalInput): PostWalletJournalInput {
    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey || idempotencyKey.length > 255) {
      throw new ConflictException('Wallet journal idempotency key is invalid.');
    }
    if (!input.kind.trim() || input.kind.length > 32 || input.entries.length < 2) {
      throw new ConflictException('Wallet journal must contain a kind and at least two entries.');
    }
    const entries = input.entries.map((entry) => ({
      ...entry,
      currency: entry.currency.trim().toUpperCase(),
      amount: this.normalizeAmount(entry.amount),
    }));
    const totals = new Map<string, bigint>();
    for (const entry of entries) {
      if (!entry.accountId || !/^[A-Z0-9]{3,10}$/.test(entry.currency)) {
        throw new ConflictException('Wallet journal entry account or currency is invalid.');
      }
      const amount = this.toUnits(entry.amount);
      const signed = entry.direction === 'debit' ? amount : -amount;
      totals.set(entry.currency, (totals.get(entry.currency) ?? 0n) + signed);
    }
    if ([...totals.values()].some((total) => total !== 0n)) {
      throw new ConflictException(
        'Wallet journal entries must balance separately for each currency.',
      );
    }
    return { ...input, idempotencyKey, entries };
  }

  private normalizeAmount(value: string): string {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value)) {
      throw new ConflictException(
        'Wallet journal amount must be a positive decimal with at most 12 places.',
      );
    }
    const units = this.toUnits(value);
    if (units <= 0n)
      throw new ConflictException('Wallet journal amount must be greater than zero.');
    const whole = units / DECIMAL_FACTOR;
    const fraction = (units % DECIMAL_FACTOR)
      .toString()
      .padStart(Number(DECIMAL_SCALE), '0')
      .replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole.toString();
  }

  private toUnits(value: string): bigint {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * DECIMAL_FACTOR + BigInt(fraction.padEnd(Number(DECIMAL_SCALE), '0'));
  }

  private toSignedUnits(value: string): bigint {
    return value.startsWith('-') ? -this.toUnits(value.slice(1)) : this.toUnits(value);
  }

  private canonicalEntries(entries: WalletJournalEntryInput[] | WalletLedgerEntry[]): string {
    return entries
      .map(
        (entry) =>
          `${entry.accountId}:${entry.direction}:${entry.currency}:${this.normalizeAmount(entry.amount)}`,
      )
      .sort()
      .join('|');
  }

  private normalizeAccountOwner(input: EnsureWalletLedgerAccountInput) {
    const tenantId = input.tenantId ?? null;
    const userId = input.userId ?? null;
    const validOrganization = input.ownerType === 'organization' && Boolean(tenantId) && !userId;
    const validEmployee = input.ownerType === 'employee' && Boolean(userId) && !tenantId;
    const validSystem = input.ownerType === 'system' && !tenantId && !userId;
    if (!validOrganization && !validEmployee && !validSystem) {
      throw new ConflictException('Wallet ledger account must have exactly one valid owner.');
    }
    return { ownerType: input.ownerType, tenantId, userId };
  }

  private accountOwnerWhere(owner: ReturnType<WalletLedgerService['normalizeAccountOwner']>) {
    return {
      ownerType: owner.ownerType,
      tenantId: owner.tenantId ?? IsNull(),
      userId: owner.userId ?? IsNull(),
    };
  }

  private async lockAccounts(manager: EntityManager, accountIds: string[]) {
    const uniqueIds = [...new Set(accountIds)].sort();
    const accounts = await manager
      .getRepository(WalletLedgerAccount)
      .createQueryBuilder('account')
      .where('account.id IN (:...accountIds)', { accountIds: uniqueIds })
      .orderBy('account.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    if (accounts.length !== uniqueIds.length) {
      throw new ConflictException('Wallet ledger account was not found.');
    }
    return accounts;
  }

  private assertMatchingOwnerAccounts(
    available: WalletLedgerAccount | undefined,
    reserved: WalletLedgerAccount | undefined,
    currency: string,
  ): asserts available is WalletLedgerAccount {
    if (
      !available ||
      !reserved ||
      available.accountType !== 'available' ||
      reserved.accountType !== 'reserved' ||
      available.ownerType === 'system' ||
      available.normalSide !== 'credit' ||
      reserved.normalSide !== 'credit' ||
      available.ownerType !== reserved.ownerType ||
      available.tenantId !== reserved.tenantId ||
      available.userId !== reserved.userId ||
      available.currency !== currency.trim().toUpperCase() ||
      reserved.currency !== currency.trim().toUpperCase() ||
      available.network !== reserved.network ||
      available.status !== 'active' ||
      reserved.status !== 'active'
    ) {
      throw new ConflictException('Available and reserved wallet accounts do not match.');
    }
  }

  async getBalanceInManager(
    manager: EntityManager,
    accountId: string,
    normalSide: 'debit' | 'credit',
  ): Promise<string> {
    const [row] = (await manager.query(
      `SELECT COALESCE(SUM(CASE WHEN direction = $2 THEN amount ELSE -amount END), 0)::text AS balance
       FROM wallet_ledger_entries
       WHERE account_id = $1`,
      [accountId, normalSide],
    )) as Array<{ balance: string }>;
    return row?.balance ?? '0';
  }
}
