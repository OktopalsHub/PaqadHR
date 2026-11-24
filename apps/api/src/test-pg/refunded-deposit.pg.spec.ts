import { randomUUID } from 'node:crypto';

import type { DataSource } from 'typeorm';

import { PaymentProvider } from '../common/enums/payment-provider.enum';
import { WalletLedgerService } from '../modules/v1/wallets/services/wallet-ledger.service';
import { createMigratedDataSource, PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('refunded deposit after funds were reserved (real migrated Postgres)', () => {
  jest.setTimeout(240_000);
  let ds: DataSource;
  let ledger: WalletLedgerService;

  beforeAll(async () => {
    ds = await createMigratedDataSource();
    ledger = new WalletLedgerService(ds);
  });
  afterAll(async () => {
    await ds?.destroy();
  });

  async function fundedWallet() {
    const tenantId = randomUUID();
    const creatorId = randomUUID();
    await ds.query('INSERT INTO "user" (id, email) VALUES ($1, $2)', [creatorId, `${creatorId}@example.com`]);
    await ds.query(
      'INSERT INTO tenants (id, name, slug, invite_code, created_by) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, 'Acme', `acme-${tenantId.slice(0, 8)}`, tenantId.slice(0, 6), creatorId],
    );
    const owner = { ownerType: 'organization' as const, tenantId, currency: 'USDC', network: 'ETHEREUM' };
    const available = await ledger.ensureAccount({ ...owner, accountType: 'available' });
    const reserved = await ledger.ensureAccount({ ...owner, accountType: 'reserved' });
    const custody = await ledger.ensureAccount({
      ownerType: 'system',
      accountType: 'custody',
      currency: 'USDC',
      network: 'ETHEREUM',
      normalSide: 'debit',
    });
    const credit = await ds.transaction((manager) =>
      ledger.postInManager(manager, {
        kind: 'wallet_funding',
        idempotencyKey: `credit:${randomUUID()}`,
        provider: PaymentProvider.BRIDGE,
        providerReference: randomUUID(),
        entries: [
          { accountId: custody.id, direction: 'debit', amount: '100.00', currency: 'USDC' },
          { accountId: available.id, direction: 'credit', amount: '100.00', currency: 'USDC' },
        ],
      }),
    );
    return { available, reserved, credit };
  }

  it('posts the reversal, leaves the wallet overdrawn, and blocks new reservations', async () => {
    const { available, reserved, credit } = await fundedWallet();
    await ds.transaction((manager) =>
      ledger.reserveFundsInManager(manager, {
        availableAccountId: available.id,
        reservedAccountId: reserved.id,
        amount: '80.00',
        currency: 'USDC',
        idempotencyKey: `reserve:${randomUUID()}`,
      }),
    );

    const balance = await ds.transaction(async (manager) => {
      await ledger.reverseInManager(manager, credit.id, `refund:${randomUUID()}`, null);
      return ledger.getBalanceInManager(manager, available.id, available.normalSide);
    });

    expect(balance.startsWith('-')).toBe(true);
    expect(Number(balance)).toBe(-80);
    await expect(
      ds.transaction((manager) =>
        ledger.reserveFundsInManager(manager, {
          availableAccountId: available.id,
          reservedAccountId: reserved.id,
          amount: '1.00',
          currency: 'USDC',
          idempotencyKey: `reserve:${randomUUID()}`,
        }),
      ),
    ).rejects.toThrow('enough available funds');
  });

  it('reverses the same deposit only once however many times Bridge repeats the event', async () => {
    const { available, credit } = await fundedWallet();
    const key = `refund:${randomUUID()}`;

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        ds.transaction((manager) => ledger.reverseInManager(manager, credit.id, key, null)),
      ),
    );

    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(Number(await ledger.getBalance(available.id))).toBe(0);
  });
});
